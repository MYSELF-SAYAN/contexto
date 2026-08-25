import { getExtension, getBasename } from './paths.js';

/**
 * Set of known binary file extensions (lowercase, with dot).
 */
export const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv',
  '.mp3', '.wav', '.ogg', '.flac', '.aac',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar', '.xz',
  '.exe', '.dll', '.so', '.dylib', '.o', '.a', '.lib',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.jar', '.war', '.class', '.pyc', '.pyo',
  '.bin', '.dat', '.db', '.sqlite', '.sqlite3',
  '.iso', '.dmg', '.img',
]);

/**
 * Patterns for files that may contain secrets.
 */
const SENSITIVE_BASENAMES = new Set([
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.staging',
  '.env.test',
  'credentials.json',
  'service-account.json',
  'serviceAccountKey.json',
]);

const SENSITIVE_EXTENSIONS = new Set([
  '.pem',
  '.key',
  '.p12',
  '.pfx',
  '.jks',
  '.keystore',
]);

/**
 * Checks if a file is binary based on its extension.
 */
export function isBinaryFile(filePath: string): boolean {
  const ext = getExtension(filePath);
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Checks if a file may contain secrets based on its name/extension.
 */
export function isSensitiveFile(filePath: string): boolean {
  const basename = getBasename(filePath);
  const ext = getExtension(filePath);

  if (SENSITIVE_BASENAMES.has(basename)) {
    return true;
  }

  if (SENSITIVE_EXTENSIONS.has(ext)) {
    return true;
  }

  // Check for .env.* pattern
  if (basename.startsWith('.env.') || basename === '.env') {
    return true;
  }

  return false;
}

/**
 * Checks if a file exceeds the maximum size.
 */
export function isLargeFile(fileSize: number, maxSize: number): boolean {
  return fileSize > maxSize;
}
