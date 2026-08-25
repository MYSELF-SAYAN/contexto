/**
 * Represents a file or directory entry in the context.
 */
export enum FileType {
  File = 'file',
  Directory = 'directory',
}

export interface FileEntry {
  /** Workspace-relative path (forward slashes) */
  relativePath: string;
  /** Absolute filesystem path */
  absolutePath: string;
  /** File or directory */
  type: FileType;
  /** File extension (lowercase, with dot), empty for directories */
  extension: string;
  /** Detected language identifier for code fences */
  language: string;
  /** File size in bytes */
  size: number;
  /** Number of lines (set after reading content) */
  lineCount?: number;
  /** Whether this entry is included in the context */
  included: boolean;
  /** Whether this entry is ignored */
  ignored: boolean;
  /** Which ignore layer excluded this entry */
  ignoreReason?: string;
  /** True if this is a binary file */
  isBinary?: boolean;
  /** True if this file may contain secrets */
  isSensitive?: boolean;
  /** True if this file exceeds maxFileSize */
  isLarge?: boolean;
  /** Child entries (for directories) */
  children?: FileEntry[];
}

/**
 * Represents a file with its read content.
 */
export interface FileContent {
  relativePath: string;
  absolutePath: string;
  language: string;
  content: string;
  lineCount: number;
}

/**
 * Represents a file that was skipped during reading.
 */
export interface SkippedFile {
  relativePath: string;
  reason: string;
}
