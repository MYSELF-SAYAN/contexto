import * as fs from 'fs';
import * as path from 'path';
import { FileEntry, FileType } from '../models/fileEntry.js';
import { IgnoreEngine } from './ignoreEngine.js';
import { normalizePath, toRelativePath, getExtension } from '../utils/paths.js';
import { isBinaryFile, isSensitiveFile, isLargeFile } from '../utils/fileUtils.js';
import { detectLanguage } from './languageDetector.js';

export interface ScanOptions {
  /** Maximum depth (0 = unlimited) */
  maxDepth?: number;
  /** Maximum file size in bytes for flagging */
  maxFileSize?: number;
}

/**
 * Async filesystem scanner.
 * Collects metadata only — never reads file contents.
 */
export class Scanner {
  /**
   * Scans a directory recursively and returns a tree of FileEntry objects.
   * Skips ignored directories early to avoid expensive traversal.
   */
  async scanDirectory(
    dirPath: string,
    workspaceRoot: string,
    ignoreEngine: IgnoreEngine,
    options: ScanOptions = {}
  ): Promise<FileEntry[]> {
    const maxDepth = options.maxDepth || 0; // 0 = unlimited
    const maxFileSize = options.maxFileSize || 1048576;

    return this.scanRecursive(dirPath, workspaceRoot, ignoreEngine, maxDepth, 0, maxFileSize);
  }

  private async scanRecursive(
    dirPath: string,
    workspaceRoot: string,
    ignoreEngine: IgnoreEngine,
    maxDepth: number,
    currentDepth: number,
    maxFileSize: number
  ): Promise<FileEntry[]> {
    // Enforce depth limit
    if (maxDepth > 0 && currentDepth >= maxDepth) {
      return [];
    }

    let dirents: fs.Dirent[];
    try {
      dirents = await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch {
      // Permission error or deleted directory — skip silently
      return [];
    }

    const entries: FileEntry[] = [];

    // Sort: directories first, then files, alphabetically
    dirents.sort((a, b) => {
      const aIsDir = a.isDirectory() ? 0 : 1;
      const bIsDir = b.isDirectory() ? 0 : 1;
      if (aIsDir !== bIsDir) {
        return aIsDir - bIsDir;
      }
      return a.name.localeCompare(b.name);
    });

    for (const dirent of dirents) {
      const absolutePath = path.join(dirPath, dirent.name);
      const relativePath = toRelativePath(absolutePath, workspaceRoot);

      if (dirent.isDirectory()) {
        // Check if directory is ignored — skip early
        const ignoreResult = ignoreEngine.isDirectoryIgnored(relativePath);

        const dirEntry: FileEntry = {
          relativePath: normalizePath(relativePath),
          absolutePath: normalizePath(absolutePath),
          type: FileType.Directory,
          extension: '',
          language: '',
          size: 0,
          included: !ignoreResult.ignored,
          ignored: ignoreResult.ignored,
          ignoreReason: ignoreResult.source,
        };

        if (!ignoreResult.ignored) {
          // Recurse into non-ignored directories
          const children = await this.scanRecursive(
            absolutePath,
            workspaceRoot,
            ignoreEngine,
            maxDepth,
            currentDepth + 1,
            maxFileSize
          );
          dirEntry.children = children;
        }

        entries.push(dirEntry);
      } else if (dirent.isFile()) {
        const ignoreResult = ignoreEngine.isIgnored(normalizePath(relativePath));
        const ext = getExtension(dirent.name);

        let size = 0;
        try {
          const stat = await fs.promises.stat(absolutePath);
          size = stat.size;
        } catch {
          // Can't stat — skip
          continue;
        }

        const binary = isBinaryFile(dirent.name);
        const sensitive = isSensitiveFile(dirent.name);
        const large = isLargeFile(size, maxFileSize);

        const entry: FileEntry = {
          relativePath: normalizePath(relativePath),
          absolutePath: normalizePath(absolutePath),
          type: FileType.File,
          extension: ext,
          language: detectLanguage(dirent.name),
          size,
          included: !ignoreResult.ignored && !binary,
          ignored: ignoreResult.ignored,
          ignoreReason: ignoreResult.source,
          isBinary: binary,
          isSensitive: sensitive,
          isLarge: large,
        };

        entries.push(entry);
      }
      // Skip symlinks and other special files
    }

    return entries;
  }

  /**
   * Flattens a tree of FileEntry objects into a flat list of files.
   */
  flattenFiles(entries: FileEntry[]): FileEntry[] {
    const result: FileEntry[] = [];

    for (const entry of entries) {
      if (entry.type === FileType.File) {
        result.push(entry);
      }
      if (entry.children) {
        result.push(...this.flattenFiles(entry.children));
      }
    }

    return result;
  }
}
