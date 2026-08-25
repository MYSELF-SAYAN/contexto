import * as fs from 'fs';
import { FileEntry, FileType } from '../models/fileEntry.js';
import { ContextSummary, createEmptySummary, Selection } from '../models/context.js';
import { IgnoreEngine } from './ignoreEngine.js';
import { Scanner, ScanOptions } from './scanner.js';
import { toAbsolutePath, normalizePath } from '../utils/paths.js';
import { isBinaryFile, isSensitiveFile, isLargeFile } from '../utils/fileUtils.js';
import { estimateTokens } from './tokenCounter.js';

/**
 * Resolves a Selection into a concrete list of FileEntry objects.
 *
 * - Expands folder selections to their current contents (resolved at call time)
 * - Removes entries whose files have been deleted from disk
 * - Deduplicates (a file in multiple selected folders appears once)
 * - Applies ignore engine with explicit-include override
 * - Marks binary, large, sensitive files
 */
export class SelectionResolver {
  private scanner = new Scanner();

  /**
   * Resolves the current selection into file entries.
   */
  async resolve(
    selection: Selection,
    ignoreEngine: IgnoreEngine,
    workspaceRoot: string,
    options: ScanOptions = {}
  ): Promise<{ entries: FileEntry[]; summary: ContextSummary }> {
    const maxFileSize = options.maxFileSize || 1048576;
    const seen = new Set<string>();
    const allEntries: FileEntry[] = [];

    // Set explicit includes on the ignore engine
    ignoreEngine.setExplicitIncludes(selection.explicitIncludes);

    // Resolve folder selections
    for (const folder of selection.folders) {
      const absolutePath = toAbsolutePath(folder, workspaceRoot);

      // Check if folder still exists
      try {
        await fs.promises.access(absolutePath);
      } catch {
        continue; // Folder deleted — skip
      }

      const entries = await this.scanner.scanDirectory(
        absolutePath,
        workspaceRoot,
        ignoreEngine,
        options
      );

      const flat = this.scanner.flattenFiles(entries);
      for (const entry of flat) {
        if (!seen.has(entry.relativePath)) {
          seen.add(entry.relativePath);
          allEntries.push(entry);
        }
      }
    }

    // Resolve individual file selections
    for (const file of selection.files) {
      if (seen.has(file)) {
        continue; // Already included via a folder
      }

      const absolutePath = toAbsolutePath(file, workspaceRoot);

      // Check if file still exists
      try {
        await fs.promises.access(absolutePath);
      } catch {
        continue; // File deleted — skip
      }

      // Check ignore status
      const ignoreResult = ignoreEngine.isIgnored(file);
      const binary = isBinaryFile(absolutePath);
      const sensitive = isSensitiveFile(absolutePath);

      let size = 0;
      try {
        const stat = await fs.promises.stat(absolutePath);
        size = stat.size;
      } catch {
        continue;
      }

      const large = isLargeFile(size, maxFileSize);
      const ext = file.includes('.') ? '.' + file.split('.').pop()!.toLowerCase() : '';

      const entry: FileEntry = {
        relativePath: normalizePath(file),
        absolutePath: normalizePath(absolutePath),
        type: FileType.File,
        extension: ext,
        language: '',
        size,
        included: !ignoreResult.ignored && !binary,
        ignored: ignoreResult.ignored,
        ignoreReason: ignoreResult.source,
        isBinary: binary,
        isSensitive: sensitive,
        isLarge: large,
      };

      seen.add(file);
      allEntries.push(entry);
    }

    // Compute summary
    const summary = this.computeSummary(allEntries);
    return { entries: allEntries, summary };
  }

  /**
   * Resolves selection into a complete tree structure (for tree building).
   */
  async resolveTree(
    selection: Selection,
    ignoreEngine: IgnoreEngine,
    workspaceRoot: string,
    options: ScanOptions = {}
  ): Promise<FileEntry[]> {
    ignoreEngine.setExplicitIncludes(selection.explicitIncludes);

    // If entire workspace is selected
    if (selection.folders.includes('.')) {
      return this.scanner.scanDirectory(
        workspaceRoot,
        workspaceRoot,
        ignoreEngine,
        options
      );
    }

    // If no files and no folders selected, return empty
    if (selection.files.length === 0 && selection.folders.length === 0) {
      return [];
    }

    // Gather all selected paths (files + folder contents)
    const selectedPaths = new Set<string>(selection.files);
    for (const folder of selection.folders) {
      const folderAbs = toAbsolutePath(folder, workspaceRoot);
      try {
        await fs.promises.access(folderAbs);
        const entries = await this.scanner.scanDirectory(folderAbs, workspaceRoot, ignoreEngine, options);
        const flat = this.scanner.flattenFiles(entries);
        for (const e of flat) {
          selectedPaths.add(e.relativePath);
        }
      } catch {
        // Skip deleted folders
      }
    }

    // Scan workspace root and filter to only include selected paths
    const fullTree = await this.scanner.scanDirectory(
      workspaceRoot,
      workspaceRoot,
      ignoreEngine,
      options
    );

    return this.filterTreeToSelection(fullTree, selectedPaths);
  }

  /**
   * Filters a tree to only include selected files and their parent directories.
   */
  private filterTreeToSelection(entries: FileEntry[], selectedFiles: Set<string>): FileEntry[] {
    const result: FileEntry[] = [];

    for (const entry of entries) {
      if (entry.type === FileType.File) {
        if (selectedFiles.has(entry.relativePath)) {
          result.push(entry);
        }
      } else if (entry.type === FileType.Directory && entry.children) {
        const filteredChildren = this.filterTreeToSelection(entry.children, selectedFiles);
        if (filteredChildren.length > 0) {
          result.push({
            ...entry,
            children: filteredChildren,
          });
        }
      }
    }

    return result;
  }

  /**
   * Computes a ContextSummary from resolved entries.
   */
  private computeSummary(entries: FileEntry[]): ContextSummary {
    const summary = createEmptySummary();

    for (const entry of entries) {
      summary.total++;

      if (entry.isBinary) {
        summary.binary++;
      } else if (entry.isLarge) {
        summary.large++;
      } else if (entry.isSensitive) {
        summary.sensitive++;
      } else if (entry.ignored) {
        summary.ignored++;
      } else if (entry.included) {
        summary.included++;
      } else {
        summary.ignored++;
      }
    }

    return summary;
  }

  /**
   * Estimates token count for the summary (without reading files).
   */
  estimateTokensFromEntries(entries: FileEntry[]): number {
    let totalChars = 0;
    for (const entry of entries) {
      if (entry.included && entry.type === FileType.File) {
        totalChars += entry.size;
      }
    }
    return estimateTokens(' '.repeat(Math.min(totalChars, 100000)));
  }
}
