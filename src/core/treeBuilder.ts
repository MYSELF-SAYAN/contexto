import { FileEntry, FileType } from '../models/fileEntry.js';

export interface TreeOptions {
  /** Root directory name to display at the top of the tree (e.g. 'project-name') */
  rootName?: string;
  /** Include files in the tree (default: true) */
  includeFiles?: boolean;
  /** Include directories in the tree (default: true) */
  includeFolders?: boolean;
  /** Include file sizes (default: false) */
  includeFileSizes?: boolean;
  /** Include line counts (default: false) */
  includeLineCounts?: boolean;
  /** Max depth (0 = unlimited) */
  depth?: number;
}

/**
 * Builds a visual directory tree string from FileEntry objects.
 * Uses standard tree characters: ├──, └──, │
 *
 * Example:
 * └── project-name/
 *     ├── README.md
 *     ├── cli/
 *     │   ├── package.json
 *     │   └── src/
 *     │       └── index.ts
 *     └── package.json
 */
export function buildTreeString(entries: FileEntry[], options: TreeOptions = {}): string {
  const opts: Required<TreeOptions> = {
    rootName: options.rootName ?? '',
    includeFiles: options.includeFiles ?? true,
    includeFolders: options.includeFolders ?? true,
    includeFileSizes: options.includeFileSizes ?? false,
    includeLineCounts: options.includeLineCounts ?? false,
    depth: options.depth ?? 0,
  };

  const lines: string[] = [];

  if (opts.rootName) {
    const rootDisplayName = opts.rootName.endsWith('/') ? opts.rootName : opts.rootName + '/';
    lines.push(`└── ${rootDisplayName}`);
    buildTreeLines(entries, '    ', opts, 0, lines);
  } else {
    buildTreeLines(entries, '', opts, 0, lines);
  }

  return lines.join('\n');
}

function buildTreeLines(
  entries: FileEntry[],
  prefix: string,
  options: Required<TreeOptions>,
  currentDepth: number,
  lines: string[]
): void {
  // Enforce depth limit
  if (options.depth > 0 && currentDepth >= options.depth) {
    return;
  }

  // Filter entries based on options
  const filtered = entries.filter(entry => {
    if (entry.type === FileType.Directory) {
      if (!options.includeFolders) {return false;}
      // If filtering to included items, only show directories with children or if directly included
      if (entry.children !== undefined && entry.children.length === 0 && !entry.included) {
        return false;
      }
      return true;
    }
    if (entry.type === FileType.File && !options.includeFiles) {
      return false;
    }
    return true;
  });

  // Sort: directories first, then files, alphabetically
  filtered.sort((a, b) => {
    const aIsDir = a.type === FileType.Directory ? 0 : 1;
    const bIsDir = b.type === FileType.Directory ? 0 : 1;
    if (aIsDir !== bIsDir) {
      return aIsDir - bIsDir;
    }
    const nameA = a.relativePath.split('/').pop() || '';
    const nameB = b.relativePath.split('/').pop() || '';
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
  });

  for (let i = 0; i < filtered.length; i++) {
    const entry = filtered[i];
    const isLast = i === filtered.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';

    const name = getDisplayName(entry);
    let suffix = '';

    if (entry.type === FileType.File) {
      if (options.includeFileSizes) {
        suffix += ` (${formatSize(entry.size)})`;
      }
      if (options.includeLineCounts && entry.lineCount !== undefined) {
        suffix += ` [${entry.lineCount} lines]`;
      }
    }

    lines.push(`${prefix}${connector}${name}${suffix}`);

    // Recurse into directories
    if (entry.type === FileType.Directory && entry.children && entry.children.length > 0) {
      buildTreeLines(entry.children, prefix + childPrefix, options, currentDepth + 1, lines);
    }
  }
}

/**
 * Gets the display name for a tree entry.
 * Directories get a trailing slash.
 */
function getDisplayName(entry: FileEntry): string {
  const parts = entry.relativePath.split('/');
  const name = parts[parts.length - 1];
  return entry.type === FileType.Directory ? name + '/' : name;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {return `${bytes} B`;}
  if (bytes < 1048576) {return `${(bytes / 1024).toFixed(1)} KB`;}
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/**
 * Builds a flat list of relative paths from entries.
 */
export function buildPathList(entries: FileEntry[]): string[] {
  const paths: string[] = [];
  collectPaths(entries, paths);
  return paths;
}

function collectPaths(entries: FileEntry[], paths: string[]): void {
  for (const entry of entries) {
    if (entry.type === FileType.File && entry.included) {
      paths.push(entry.relativePath);
    }
    if (entry.children) {
      collectPaths(entry.children, paths);
    }
  }
}
