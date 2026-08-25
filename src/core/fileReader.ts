import * as fs from 'fs';
import { isBinaryFile, isSensitiveFile, isLargeFile } from '../utils/fileUtils.js';
import { FileContent, SkippedFile } from '../models/fileEntry.js';
import { detectLanguage } from './languageDetector.js';
import { normalizePath, toRelativePath } from '../utils/paths.js';

export interface ReadResult {
  files: FileContent[];
  skipped: SkippedFile[];
}

/**
 * Reads file contents for included files.
 * Skips binary, large, and sensitive files.
 */
export async function readFiles(
  absolutePaths: string[],
  workspaceRoot: string,
  maxFileSize: number,
  includeEmptyLines: boolean = true
): Promise<ReadResult> {
  const files: FileContent[] = [];
  const skipped: SkippedFile[] = [];

  for (const absolutePath of absolutePaths) {
    const relativePath = normalizePath(toRelativePath(absolutePath, workspaceRoot));

    // Skip binary files
    if (isBinaryFile(absolutePath)) {
      skipped.push({ relativePath, reason: 'Binary file' });
      continue;
    }

    // Check file size
    let size: number;
    try {
      const stat = await fs.promises.stat(absolutePath);
      size = stat.size;
    } catch {
      skipped.push({ relativePath, reason: 'File not found or inaccessible' });
      continue;
    }

    if (isLargeFile(size, maxFileSize)) {
      skipped.push({ relativePath, reason: `File too large (${formatSize(size)})` });
      continue;
    }

    // Sensitive files are skipped by default (but can be explicitly included)
    if (isSensitiveFile(absolutePath)) {
      skipped.push({ relativePath, reason: 'Potential sensitive file' });
      continue;
    }

    // Read file content
    try {
      let content = await fs.promises.readFile(absolutePath, 'utf-8');

      if (!includeEmptyLines) {
        content = content
          .split('\n')
          .filter(line => line.trim().length > 0)
          .join('\n');
      }

      const lineCount = content.split('\n').length;

      files.push({
        relativePath,
        absolutePath: normalizePath(absolutePath),
        language: detectLanguage(absolutePath),
        content,
        lineCount,
      });
    } catch {
      skipped.push({ relativePath, reason: 'Failed to read file (encoding error or inaccessible)' });
    }
  }

  return { files, skipped };
}

/**
 * Reads a single file's content.
 */
export async function readSingleFile(
  absolutePath: string,
  workspaceRoot: string,
  maxFileSize: number
): Promise<FileContent | SkippedFile> {
  const result = await readFiles([absolutePath], workspaceRoot, maxFileSize);
  if (result.files.length > 0) {
    return result.files[0];
  }
  return result.skipped[0];
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {return `${bytes} B`;}
  if (bytes < 1048576) {return `${(bytes / 1024).toFixed(1)} KB`;}
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
