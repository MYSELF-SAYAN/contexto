import * as fs from 'fs';
import * as path from 'path';
import ignore, { Ignore } from 'ignore';
import { IgnoreSource, IgnoreResult } from '../models/ignoreRule.js';
import { getSettings } from '../models/settings.js';

/**
 * Default patterns that are always ignored unless explicitly included.
 */
export const DEFAULT_IGNORE_PATTERNS: string[] = [
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'coverage',
  '.cache',
  '.turbo',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  'env',
  '.tox',
  '.mypy_cache',
  '.ruff_cache',
  'target',       // Rust/Java build output
  '.gradle',
  '.idea',
  '.vs',
  '*.lock',
  '*.map',
  '*.min.js',
  '*.min.css',
];

/**
 * Manages the multi-layered ignore system.
 *
 * Precedence (highest to lowest):
 *   1. Direct Explicit Include (unignored file/folder)
 *   2. User Ignore (manually ignored by user)
 *   3. Folder Explicit Include (unignored parent folder)
 *   4. .contextignore
 *   5. .gitignore
 *   6. Default Ignore
 */
export class IgnoreEngine {
  private defaultIgnore: Ignore;
  private gitignore: Ignore | null = null;
  private contextignore: Ignore | null = null;
  private userIgnore: Ignore;

  /** Direct exact paths that override all ignore layers */
  private explicitIncludes: Set<string> = new Set();
  /** Folder prefixes whose descendants are unignored (unless overridden by a user ignore) */
  private explicitIncludeFolders: Set<string> = new Set();

  private gitignoreLoaded = false;
  private contextignoreLoaded = false;

  private _userPatterns: string[] = [];

  constructor() {
    this.defaultIgnore = ignore().add(DEFAULT_IGNORE_PATTERNS);
    this.userIgnore = ignore();
  }

  /**
   * Loads all ignore layers for a workspace.
   */
  async loadForWorkspace(workspaceRoot: string): Promise<void> {
    const settings = getSettings();

    // Load .gitignore
    if (settings.respectGitignore) {
      await this.loadGitignore(workspaceRoot);
    }

    // Load .contextignore
    if (settings.useContextignore) {
      await this.loadContextignore(workspaceRoot);
    }

    // Load user ignore patterns
    this.loadUserIgnores(settings.ignore);

    // Load persisted explicit includes from settings
    this.loadExplicitIncludes(settings.explicitIncludes);
  }

  /**
   * Parses .gitignore from the workspace root.
   */
  async loadGitignore(workspaceRoot: string): Promise<void> {
    const gitignorePath = path.join(workspaceRoot, '.gitignore');
    try {
      const content = await fs.promises.readFile(gitignorePath, 'utf-8');
      this.gitignore = ignore().add(content);
      this.gitignoreLoaded = true;
    } catch {
      this.gitignore = null;
      this.gitignoreLoaded = false;
    }
  }

  /**
   * Parses .contextignore from the workspace root.
   */
  async loadContextignore(workspaceRoot: string): Promise<void> {
    const contextignorePath = path.join(workspaceRoot, '.contextignore');
    try {
      const content = await fs.promises.readFile(contextignorePath, 'utf-8');
      this.contextignore = ignore().add(content);
      this.contextignoreLoaded = true;
    } catch {
      this.contextignore = null;
      this.contextignoreLoaded = false;
    }
  }

  /**
   * Loads user-defined ignore patterns from settings.
   */
  loadUserIgnores(patterns: string[]): void {
    this.userIgnore = ignore();
    this._userPatterns = [...patterns];
    if (patterns.length > 0) {
      this.userIgnore.add(patterns);
    }
  }

  /**
   * Loads explicit includes from settings.
   */
  loadExplicitIncludes(includes: string[]): void {
    this.explicitIncludes = new Set();
    this.explicitIncludeFolders = new Set();
    for (const inc of includes) {
      this.explicitIncludes.add(inc);
      if (inc.endsWith('/**')) {
        this.explicitIncludeFolders.add(inc.slice(0, -3));
      } else {
        this.explicitIncludeFolders.add(inc);
      }
    }
  }

  /**
   * Merges additional explicit includes (from in-memory state).
   */
  setExplicitIncludes(includes: string[]): void {
    for (const inc of includes) {
      this.explicitIncludes.add(inc);
      if (inc.endsWith('/**')) {
        this.explicitIncludeFolders.add(inc.slice(0, -3));
      } else {
        this.explicitIncludeFolders.add(inc);
      }
    }
  }

  /**
   * Adds a single explicit include.
   */
  addExplicitInclude(relativePath: string): void {
    this.explicitIncludes.add(relativePath);
    if (relativePath.endsWith('/**')) {
      this.explicitIncludeFolders.add(relativePath.slice(0, -3));
    } else {
      this.explicitIncludeFolders.add(relativePath);
    }
  }

  /**
   * Removes a single explicit include.
   */
  removeExplicitInclude(relativePath: string): void {
    this.explicitIncludes.delete(relativePath);
    this.explicitIncludes.delete(relativePath + '/**');
    this.explicitIncludeFolders.delete(relativePath);
    if (relativePath.endsWith('/**')) {
      this.explicitIncludeFolders.delete(relativePath.slice(0, -3));
    }
  }

  /**
   * Returns the current explicit includes as an array.
   */
  getExplicitIncludes(): string[] {
    return Array.from(this.explicitIncludes);
  }

  /**
   * Returns the user-managed ignore patterns.
   */
  getUserIgnorePatterns(): string[] {
    return [...this._userPatterns];
  }

  /**
   * Checks if a path is directly explicitly included.
   */
  private isDirectlyExplicitlyIncluded(relativePath: string): boolean {
    return (
      this.explicitIncludes.has(relativePath) ||
      this.explicitIncludes.has(relativePath + '/**') ||
      this.explicitIncludes.has(relativePath + '/')
    );
  }

  /**
   * Checks if a path's parent folder is explicitly included.
   */
  private isFolderExplicitlyIncluded(relativePath: string): boolean {
    for (const folder of this.explicitIncludeFolders) {
      if (relativePath === folder || relativePath.startsWith(folder + '/')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if a workspace-relative path is ignored.
   * Respects the full precedence hierarchy.
   */
  isIgnored(relativePath: string): IgnoreResult {
    // 1. Direct explicit include (highest priority)
    if (this.isDirectlyExplicitlyIncluded(relativePath)) {
      return { ignored: false };
    }

    // 2. User ignore patterns (explicitly ignored by user clicking eye-closed)
    try {
      if (this.userIgnore.ignores(relativePath)) {
        return { ignored: true, source: IgnoreSource.User };
      }
    } catch {
      // Invalid pattern — skip
    }

    // 3. Inherited folder explicit include
    if (this.isFolderExplicitlyIncluded(relativePath)) {
      return { ignored: false };
    }

    // 4. .contextignore
    if (this.contextignore) {
      try {
        if (this.contextignore.ignores(relativePath)) {
          return { ignored: true, source: IgnoreSource.Contextignore };
        }
      } catch {
        // Invalid pattern — skip
      }
    }

    // 5. .gitignore
    if (this.gitignore) {
      try {
        if (this.gitignore.ignores(relativePath)) {
          return { ignored: true, source: IgnoreSource.Gitignore };
        }
      } catch {
        // Invalid pattern — skip
      }
    }

    // 6. Default ignores
    try {
      if (this.defaultIgnore.ignores(relativePath)) {
        return { ignored: true, source: IgnoreSource.Default };
      }
    } catch {
      // Invalid pattern — skip
    }

    return { ignored: false };
  }

  /**
   * Checks if a directory path should be skipped during scanning.
   */
  isDirectoryIgnored(relativePath: string): IgnoreResult {
    const cleanPath = relativePath.endsWith('/') ? relativePath.slice(0, -1) : relativePath;

    // 1. Direct explicit include
    if (this.isDirectlyExplicitlyIncluded(cleanPath)) {
      return { ignored: false };
    }

    // 2. User ignore
    try {
      if (this.userIgnore.ignores(cleanPath) || this.userIgnore.ignores(cleanPath + '/')) {
        return { ignored: true, source: IgnoreSource.User };
      }
    } catch {
      // Skip
    }

    // 3. Inherited folder explicit include
    if (this.isFolderExplicitlyIncluded(cleanPath)) {
      return { ignored: false };
    }

    // 4. .contextignore
    if (this.contextignore) {
      try {
        if (this.contextignore.ignores(cleanPath) || this.contextignore.ignores(cleanPath + '/')) {
          return { ignored: true, source: IgnoreSource.Contextignore };
        }
      } catch {
        // Skip
      }
    }

    // 5. .gitignore
    if (this.gitignore) {
      try {
        if (this.gitignore.ignores(cleanPath) || this.gitignore.ignores(cleanPath + '/')) {
          return { ignored: true, source: IgnoreSource.Gitignore };
        }
      } catch {
        // Skip
      }
    }

    // 6. Default ignores
    try {
      if (this.defaultIgnore.ignores(cleanPath) || this.defaultIgnore.ignores(cleanPath + '/')) {
        return { ignored: true, source: IgnoreSource.Default };
      }
    } catch {
      // Skip
    }

    return { ignored: false };
  }

  /**
   * Returns a human-readable description of why a path is ignored.
   */
  getIgnoreDescription(relativePath: string): string {
    const cleanPath = relativePath.endsWith('/') ? relativePath.slice(0, -1) : relativePath;

    if (this.isDirectlyExplicitlyIncluded(cleanPath)) {
      return 'not ignored';
    }

    const result = this.isIgnored(cleanPath);
    if (result.ignored) {
      return this.formatIgnoreDescription(result.source);
    }

    const dirResult = this.isDirectoryIgnored(cleanPath);
    if (dirResult.ignored) {
      return this.formatIgnoreDescription(dirResult.source);
    }

    return 'not ignored';
  }

  private formatIgnoreDescription(source?: IgnoreSource): string {
    switch (source) {
      case IgnoreSource.Default:
        return 'default';
      case IgnoreSource.Gitignore:
        return '.gitignore';
      case IgnoreSource.Contextignore:
        return '.contextignore';
      case IgnoreSource.User:
        return 'ignored';
      default:
        return 'rule';
    }
  }

  /**
   * Whether .gitignore was successfully loaded.
   */
  get hasGitignore(): boolean {
    return this.gitignoreLoaded;
  }

  /**
   * Whether .contextignore was successfully loaded.
   */
  get hasContextignore(): boolean {
    return this.contextignoreLoaded;
  }
}
