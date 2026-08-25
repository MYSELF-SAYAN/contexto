import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

/**
 * Normalizes a file path to use forward slashes.
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Converts an absolute path to a workspace-relative path.
 */
export function toRelativePath(absolutePath: string, workspaceRoot: string): string {
  const normalized = normalizePath(absolutePath);
  const normalizedRoot = normalizePath(workspaceRoot);
  const rootWithSlash = normalizedRoot.endsWith('/') ? normalizedRoot : normalizedRoot + '/';

  if (normalized.startsWith(rootWithSlash)) {
    return normalized.substring(rootWithSlash.length);
  }

  // Fallback: use path.relative
  return normalizePath(path.relative(workspaceRoot, absolutePath));
}

/**
 * Converts a workspace-relative path to an absolute path.
 */
export function toAbsolutePath(relativePath: string, workspaceRoot: string): string {
  return path.resolve(workspaceRoot, relativePath);
}

/**
 * Gets the file extension (lowercase, with dot).
 * Returns empty string for files without extensions.
 */
export function getExtension(filePath: string): string {
  const ext = path.extname(filePath);
  return ext.toLowerCase();
}

/**
 * Gets the basename of a file path.
 */
export function getBasename(filePath: string): string {
  return path.basename(filePath);
}

/**
 * Gets the directory name of a file path.
 */
export function getDirname(filePath: string): string {
  return normalizePath(path.dirname(filePath));
}

export interface ExtractedPath {
  absolutePath: string;
  relativePath: string;
  isDirectory: boolean;
}

/**
 * Helper to extract absolute, relative paths, and directory status from either a vscode.Uri,
 * a TreeItem (WorkspaceTreeItem), or undefined.
 */
export function extractPathFromArg(
  arg: any,
  workspaceRoot: string
): ExtractedPath | undefined {
  if (!arg) {
    return undefined;
  }

  let abs: string | undefined;
  let rel: string | undefined;
  let isDir: boolean | undefined;

  if (arg instanceof vscode.Uri) {
    abs = arg.fsPath;
    rel = normalizePath(toRelativePath(abs, workspaceRoot));
  } else if (typeof arg === 'object') {
    if (typeof arg.isDirectory === 'boolean') {
      isDir = arg.isDirectory;
    }
    if (typeof arg.absolutePath === 'string' && arg.absolutePath.length > 0) {
      const explicitAbs = arg.absolutePath as string;
      abs = explicitAbs;
      rel = typeof arg.relativePath === 'string' && arg.relativePath.length > 0
        ? normalizePath(arg.relativePath)
        : normalizePath(toRelativePath(explicitAbs, workspaceRoot));
    } else if (arg.resourceUri && typeof arg.resourceUri.fsPath === 'string') {
      const resAbs = arg.resourceUri.fsPath as string;
      abs = resAbs;
      rel = typeof arg.relativePath === 'string' && arg.relativePath.length > 0
        ? normalizePath(arg.relativePath)
        : normalizePath(toRelativePath(resAbs, workspaceRoot));
    } else if (typeof arg.relativePath === 'string' && arg.relativePath.length > 0) {
      rel = normalizePath(arg.relativePath);
      abs = toAbsolutePath(rel, workspaceRoot);
    }
  }

  if (!abs || !rel) {
    return undefined;
  }

  if (isDir === undefined) {
    try {
      if (fs.existsSync(abs)) {
        isDir = fs.statSync(abs).isDirectory();
      }
    } catch {
      isDir = false;
    }
  }

  return {
    absolutePath: normalizePath(abs),
    relativePath: normalizePath(rel),
    isDirectory: Boolean(isDir),
  };
}
