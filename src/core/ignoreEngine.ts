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
 *   1. Direct Explicit Include (unignored file/folder)  — exact path set
 *   2. User Ignore (manually ignored by user)           — exact path set + ignore-lib globs
 *   3. Folder Explicit Include (unignored parent folder) — prefix set
 *   4. .contextignore                                    — ignore-lib
 *   5. .gitignore                                        — ignore-lib
 *   6. Default Ignore                                    — ignore-lib
 *
 * User ignore patterns are matched TWO ways:
 *   - As exact paths (stored in _userExactPaths)
 *   - As glob patterns via the `ignore` library (stored in _userIgnore)
 * This guarantees that both "src/foo.ts" (exact) and "*.log" (glob) work correctly.
 */
export class IgnoreEngine {
  private defaultIgnore: Ignore;
  private gitignore: Ignore | null = null;
  private contextignore: Ignore | null = null;

  /**
   * Glob-based user ignore (for patterns like *.log, src/**)
   */
  private _userIgnore: Ignore;

  /**
   * Exact user-ignored paths — NOT run through the glob engine.
   * This is the primary fix: ignoring "src/foo.ts" should match exactly,
   * not be subject to glob interpretation quirks.
   */
  private _userExactPaths: Set<string> = new Set();

  /**
   * Exact user-ignored folder paths + their "/**" globs.
   * When a folder is ignored, both the folder path and folder/** are stored.
   */
  private _userExactFolders: Set<string> = new Set();

  /** Direct exact paths that override ALL ignore layers */
  private _explicitIncludes: Set<string> = new Set();

  /** Folder prefixes whose descendants are unignored (unless overridden by a user ignore) */
  private _explicitIncludeFolders: Set<string> = new Set();

  private gitignoreLoaded = false;
  private contextignoreLoaded = false;

  private _userPatterns: string[] = [];

  constructor() {
    this.defaultIgnore = ignore().add(DEFAULT_IGNORE_PATTERNS);
    this._userIgnore = ignore();
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
   * Returns true if a pattern looks like a glob (contains *, ?, !, [, {).
   * Exact paths are handled via Set lookups for robustness.
   */
  private static isGlobPattern(pattern: string): boolean {
    return /[*?!\[{]/.test(pattern);
  }

  /**
   * Loads user-defined ignore patterns from settings.
   *
   * Patterns are split into two buckets:
   * - Exact paths → stored in _userExactPaths / _userExactFolders for Set-based lookups
   * - Glob patterns → passed to the `ignore` library
   *
   * This dual approach prevents the `ignore` library from misinterpreting
   * exact paths (e.g. "src/foo.ts" being treated as a glob).
   */
  loadUserIgnores(patterns: string[]): void {
    this._userIgnore = ignore();
    this._userExactPaths = new Set();
    this._userExactFolders = new Set();
    this._userPatterns = [...patterns];

    const globPatterns: string[] = [];

    for (const raw of patterns) {
      const p = raw.trim();
      if (!p || p.startsWith('#')) {
        continue; // skip empty / comment lines
      }

      if (p.endsWith('/**')) {
        // Folder ignore: "src/**" → exact folder "src"
        const folder = p.slice(0, -3);
        this._userExactFolders.add(folder);
        this._userExactPaths.add(folder);
        this._userExactPaths.add(p);
      } else if (IgnoreEngine.isGlobPattern(p)) {
        globPatterns.push(p);
      } else {
        // Exact path (could be file or folder)
        this._userExactPaths.add(p);
      }
    }

    if (globPatterns.length > 0) {
      this._userIgnore.add(globPatterns);
    }
  }

  /**
   * Loads explicit includes from settings.
   * Distinguishes between file includes and folder includes.
   */
  loadExplicitIncludes(includes: string[]): void {
    this._explicitIncludes = new Set();
    this._explicitIncludeFolders = new Set();
    for (const inc of includes) {
      const trimmed = inc.trim();
      if (!trimmed) { continue; }
      this._explicitIncludes.add(trimmed);
      if (trimmed.endsWith('/**')) {
        // "src/**" → folder prefix "src"
        this._explicitIncludeFolders.add(trimmed.slice(0, -3));
      }
      // NOTE: we do NOT add non-glob paths to _explicitIncludeFolders.
      // Only folder globs (ending with /**) create folder-prefix overrides.
    }
  }

  /**
   * Merges additional explicit includes (from in-memory state).
   */
  setExplicitIncludes(includes: string[]): void {
    for (const inc of includes) {
      const trimmed = inc.trim();
      if (!trimmed) { continue; }
      this._explicitIncludes.add(trimmed);
      if (trimmed.endsWith('/**')) {
        this._explicitIncludeFolders.add(trimmed.slice(0, -3));
      }
    }
  }

  /**
   * Adds a single explicit include.
   */
  addExplicitInclude(relativePath: string): void {
    this._explicitIncludes.add(relativePath);
    if (relativePath.endsWith('/**')) {
      this._explicitIncludeFolders.add(relativePath.slice(0, -3));
    }
  }

  /**
   * Removes a single explicit include.
   */
  removeExplicitInclude(relativePath: string): void {
    this._explicitIncludes.delete(relativePath);
    this._explicitIncludes.delete(relativePath + '/**');
    if (relativePath.endsWith('/**')) {
      this._explicitIncludeFolders.delete(relativePath.slice(0, -3));
    } else {
      this._explicitIncludeFolders.delete(relativePath);
    }
  }

  /**
   * Returns the current explicit includes as an array.
   */
  getExplicitIncludes(): string[] {
    return Array.from(this._explicitIncludes);
  }

  /**
   * Returns the user-managed ignore patterns.
   */
  getUserIgnorePatterns(): string[] {
    return [...this._userPatterns];
  }

  /**
   * Checks if a path is directly explicitly included (exact match).
   */
  private isDirectlyExplicitlyIncluded(relativePath: string): boolean {
    return (
      this._explicitIncludes.has(relativePath) ||
      this._explicitIncludes.has(relativePath + '/**') ||
      this._explicitIncludes.has(relativePath + '/')
    );
  }

  /**
   * Checks if a path's parent folder is explicitly included.
   */
  private isFolderExplicitlyIncluded(relativePath: string): boolean {
    for (const folder of this._explicitIncludeFolders) {
      if (relativePath === folder || relativePath.startsWith(folder + '/')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if a path is user-ignored via exact path match or glob match.
   */
  private isUserIgnored(relativePath: string): boolean {
    // 1. Exact path match
    if (this._userExactPaths.has(relativePath)) {
      return true;
    }

    // 2. Check if any user-ignored folder is a parent
    for (const folder of this._userExactFolders) {
      if (relativePath.startsWith(folder + '/')) {
        return true;
      }
    }

    // 3. Glob pattern match via `ignore` library
    try {
      if (this._userIgnore.ignores(relativePath)) {
        return true;
      }
    } catch {
      // Invalid pattern — skip
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

    // 2. User ignore patterns (explicitly ignored by user clicking eye)
    if (this.isUserIgnored(relativePath)) {
      return { ignored: true, source: IgnoreSource.User };
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

    // 2. User ignore — exact path or folder set or glob
    if (this._userExactPaths.has(cleanPath) || this._userExactFolders.has(cleanPath)) {
      return { ignored: true, source: IgnoreSource.User };
    }
    // Check if a parent folder is user-ignored
    for (const folder of this._userExactFolders) {
      if (cleanPath.startsWith(folder + '/')) {
        return { ignored: true, source: IgnoreSource.User };
      }
    }
    // Check glob patterns
    try {
      if (this._userIgnore.ignores(cleanPath) || this._userIgnore.ignores(cleanPath + '/')) {
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
