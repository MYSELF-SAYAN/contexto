import * as vscode from 'vscode';
import { Selection, createEmptySelection, OutputFormat, ContextSummary, createEmptySummary } from '../models/context.js';
import { FileEntry, FileType } from '../models/fileEntry.js';
import { IgnoreEngine } from './ignoreEngine.js';
import { SelectionResolver } from './selectionResolver.js';
import { Scanner } from './scanner.js';
import { getSettings } from '../models/settings.js';
import { normalizePath, toRelativePath } from '../utils/paths.js';

/**
 * Manages the current context selection state.
 * Uses Sets for O(1) lookups and live reactivity.
 */
export class ContextManager {
  private _files = new Set<string>();
  private _folders = new Set<string>();
  private _explicitIncludes = new Set<string>();
  private instructions = '';
  private outputFormat: OutputFormat;
  private ignoreEngine: IgnoreEngine;
  private resolver: SelectionResolver;
  private scanner: Scanner;
  private workspaceRoot: string;
  private fileWatcher: vscode.FileSystemWatcher | undefined;

  /**
   * Guard to prevent re-entrant reloads when we persist settings.
   * Incremented before writing, decremented after the config change event fires.
   * Using a counter (not a boolean) to handle overlapping writes safely.
   */
  private _suppressConfigReloadCount = 0;

  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.ignoreEngine = new IgnoreEngine();
    this.resolver = new SelectionResolver();
    this.scanner = new Scanner();
    this.outputFormat = getSettings().defaultFormat;

    // Watch for file deletions to auto-remove from context
    this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
    this.fileWatcher.onDidDelete((uri) => {
      const relativePath = normalizePath(toRelativePath(uri.fsPath, this.workspaceRoot));
      this.removeFile(relativePath);
    });
  }

  /**
   * Whether config reload should be suppressed (we just wrote settings ourselves).
   */
  get suppressConfigReload(): boolean {
    return this._suppressConfigReloadCount > 0;
  }

  /**
   * Enters the "suppress config reload" zone. Must be paired with exitSuppressZone().
   */
  enterSuppressZone(): void {
    this._suppressConfigReloadCount++;
  }

  /**
   * Leaves the "suppress config reload" zone after a short delay
   * so the configuration change event has time to fire first.
   */
  exitSuppressZone(): void {
    setTimeout(() => {
      this._suppressConfigReloadCount = Math.max(0, this._suppressConfigReloadCount - 1);
    }, 200);
  }

  /**
   * Initializes the ignore engine for the workspace.
   */
  async initialize(): Promise<void> {
    await this.ignoreEngine.loadForWorkspace(this.workspaceRoot);
    // Load persisted explicit includes into our local set
    const settings = getSettings();
    for (const inc of settings.explicitIncludes) {
      this._explicitIncludes.add(normalizePath(inc));
    }
  }

  /**
   * Reloads the ignore engine (e.g., after settings change).
   */
  async reloadIgnoreEngine(): Promise<void> {
    this.ignoreEngine = new IgnoreEngine();
    const settings = getSettings();
    this._explicitIncludes = new Set(settings.explicitIncludes.map(normalizePath));
    await this.ignoreEngine.loadForWorkspace(this.workspaceRoot);
    this._onDidChange.fire();
  }

  // ── Selection mutations ──────────────────────────────────────

  addFile(relativePath: string): void {
    const normalized = normalizePath(relativePath);
    if (!this._files.has(normalized)) {
      this._files.add(normalized);
      this._onDidChange.fire();
    }
  }

  addFiles(relativePaths: string[]): void {
    let changed = false;
    for (const p of relativePaths) {
      const normalized = normalizePath(p);
      if (!this._files.has(normalized)) {
        this._files.add(normalized);
        changed = true;
      }
    }
    if (changed) {
      this._onDidChange.fire();
    }
  }

  addFileBatch(relativePaths: string[]): void {
    let changed = false;
    for (const p of relativePaths) {
      const normalized = normalizePath(p);
      if (!this._files.has(normalized)) {
        this._files.add(normalized);
        changed = true;
      }
    }
    if (changed) {
      this._onDidChange.fire();
    }
  }

  removeFilesUnderFolder(folderPath: string): void {
    const prefix = normalizePath(folderPath);
    let changed = false;

    // Remove folder itself from _folders
    if (this._folders.delete(prefix)) {
      changed = true;
    }

    // Remove any subfolders
    for (const folder of this._folders) {
      if (folder.startsWith(prefix + '/')) {
        this._folders.delete(folder);
        changed = true;
      }
    }

    // Remove matching files
    for (const file of this._files) {
      if (file === prefix || file.startsWith(prefix + '/')) {
        this._files.delete(file);
        changed = true;
      }
    }

    if (changed) {
      this._onDidChange.fire();
    }
  }

  addFolder(relativePath: string): void {
    const normalized = normalizePath(relativePath);
    if (!this._folders.has(normalized)) {
      this._folders.add(normalized);
      this._onDidChange.fire();
    }
  }

  /**
   * Selects all non-ignored files and folders in the entire workspace.
   */
  async selectAll(): Promise<void> {
    const entries = await this.scanner.scanDirectory(
      this.workspaceRoot,
      this.workspaceRoot,
      this.ignoreEngine
    );
    const flatFiles = this.scanner.flattenFiles(entries);
    const paths = flatFiles.filter(e => e.included && !e.isBinary).map(e => e.relativePath);

    for (const p of paths) {
      this._files.add(normalizePath(p));
    }

    const collectDirs = (items: FileEntry[]) => {
      for (const item of items) {
        if (item.type === FileType.Directory) {
          this._folders.add(normalizePath(item.relativePath));
          if (item.children) {
            collectDirs(item.children);
          }
        }
      }
    };
    collectDirs(entries);
    this._folders.add('.');

    this._onDidChange.fire();
  }

  removeFile(relativePath: string): void {
    const normalized = normalizePath(relativePath);
    const deleted = this._files.delete(normalized);
    this._explicitIncludes.delete(normalized);

    // If any parent folder was in _folders, remove it so unchecking this file is respected
    for (const folder of this._folders) {
      if (normalized.startsWith(folder + '/') || folder === '.') {
        this._folders.delete(folder);
      }
    }

    if (deleted) {
      this._onDidChange.fire();
    }
  }

  removeFolder(relativePath: string): void {
    const normalized = normalizePath(relativePath);
    const deleted = this._folders.delete(normalized);
    if (deleted) {
      this._onDidChange.fire();
    }
  }

  remove(relativePath: string): void {
    const normalized = normalizePath(relativePath);
    const deletedFile = this._files.delete(normalized);
    const deletedFolder = this._folders.delete(normalized);
    this._explicitIncludes.delete(normalized);
    if (deletedFile || deletedFolder) {
      this._onDidChange.fire();
    }
  }

  clear(): void {
    const hadItems = this._files.size > 0 || this._folders.size > 0;
    this._files.clear();
    this._folders.clear();
    this._explicitIncludes.clear();
    this.instructions = '';
    if (hadItems) {
      this._onDidChange.fire();
    }
  }

  /**
   * Adds an explicit include for a path — overrides all ignore layers.
   * For folders, adds "path/**" so all children are also included.
   * Persists to workspace settings so it survives restarts.
   */
  async addExplicitInclude(relativePath: string, isFolder: boolean = false): Promise<void> {
    const normalized = normalizePath(relativePath);
    if (isFolder) {
      // For folders: add both the folder itself and folder/** for children
      const folderGlob = normalized + '/**';
      this._explicitIncludes.add(normalized);
      this._explicitIncludes.add(folderGlob);
      this.ignoreEngine.addExplicitInclude(normalized);
      this.ignoreEngine.addExplicitInclude(folderGlob);
    } else {
      this._explicitIncludes.add(normalized);
      this.ignoreEngine.addExplicitInclude(normalized);
    }
    await this.persistExplicitIncludes();
  }

  /**
   * Removes an explicit include for a path.
   * For folders, also removes all child explicit includes.
   * Persists to workspace settings.
   */
  async removeExplicitInclude(relativePath: string): Promise<void> {
    const normalized = normalizePath(relativePath);
    const toDelete: string[] = [];
    for (const inc of this._explicitIncludes) {
      if (inc === normalized || inc === normalized + '/**' || inc.startsWith(normalized + '/')) {
        toDelete.push(inc);
      }
    }
    for (const inc of toDelete) {
      this._explicitIncludes.delete(inc);
      this.ignoreEngine.removeExplicitInclude(inc);
    }
    await this.persistExplicitIncludes();
  }

  /**
   * Persists the current explicit includes to workspace settings.
   * Uses suppress zone to avoid re-entrant reload.
   */
  private async persistExplicitIncludes(): Promise<void> {
    try {
      this.enterSuppressZone();
      const config = vscode.workspace.getConfiguration('contexto');
      const includes = Array.from(this._explicitIncludes);
      await config.update('explicitIncludes', includes, vscode.ConfigurationTarget.Workspace);
    } catch {
      // Settings write failed — non-critical, ignore silently
    } finally {
      this.exitSuppressZone();
    }
  }

  /**
   * Updates the user ignore list in workspace settings.
   * Uses suppress zone to avoid re-entrant reload.
   */
  async updateUserIgnoreSettings(patterns: string[]): Promise<void> {
    try {
      this.enterSuppressZone();
      const config = vscode.workspace.getConfiguration('contexto');
      await config.update('ignore', patterns, vscode.ConfigurationTarget.Workspace);
    } catch {
      // Settings write failed — non-critical
    } finally {
      this.exitSuppressZone();
    }
  }

  // ── Checkbox State ───────────────────────────────────────────

  isPathSelected(relativePath: string, isDirectory: boolean = false): boolean {
    const normalized = normalizePath(relativePath);

    if (!isDirectory) {
      return this._files.has(normalized);
    }

    return this._folders.has(normalized);
  }

  // ── Options ──────────────────────────────────────────────────

  setInstructions(text: string): void {
    this.instructions = text;
    this._onDidChange.fire();
  }

  getInstructions(): string {
    return this.instructions;
  }

  setOutputFormat(format: OutputFormat): void {
    this.outputFormat = format;
    this._onDidChange.fire();
  }

  getOutputFormat(): OutputFormat {
    return this.outputFormat;
  }

  // ── Queries ──────────────────────────────────────────────────

  getSelection(): Selection {
    return {
      files: Array.from(this._files),
      folders: Array.from(this._folders),
      explicitIncludes: Array.from(this._explicitIncludes),
    };
  }

  getIgnoreEngine(): IgnoreEngine {
    return this.ignoreEngine;
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  getScanner(): Scanner {
    return this.scanner;
  }

  isEmpty(): boolean {
    return this._files.size === 0 && this._folders.size === 0;
  }

  getFileCount(): number {
    return this._files.size;
  }

  getSelectedFileCount(): number {
    return this._files.size;
  }

  getSelectionPaths(): string[] {
    return [...this._folders, ...this._files];
  }

  // ── Resolution ───────────────────────────────────────────────

  async resolveSelection(): Promise<{ entries: FileEntry[]; summary: ContextSummary }> {
    const settings = getSettings();
    return this.resolver.resolve(
      this.getSelection(),
      this.ignoreEngine,
      this.workspaceRoot,
      { maxFileSize: settings.maxFileSize, maxDepth: settings.treeDepth }
    );
  }

  async resolveTree(): Promise<FileEntry[]> {
    const settings = getSettings();
    return this.resolver.resolveTree(
      this.getSelection(),
      this.ignoreEngine,
      this.workspaceRoot,
      { maxFileSize: settings.maxFileSize, maxDepth: settings.treeDepth }
    );
  }

  async getQuickSummary(): Promise<ContextSummary> {
    if (this.isEmpty()) {
      return createEmptySummary();
    }

    try {
      const { summary } = await this.resolveSelection();
      return summary;
    } catch {
      return createEmptySummary();
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────

  dispose(): void {
    this.fileWatcher?.dispose();
    this._onDidChange.dispose();
  }
}
