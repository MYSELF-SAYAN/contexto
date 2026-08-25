/**
 * Ignore rule sources, ordered by precedence (lowest to highest).
 */
export enum IgnoreSource {
  Default = 'default',
  Gitignore = 'gitignore',
  Contextignore = 'contextignore',
  User = 'user',
}

/**
 * Represents a single ignore rule with its origin.
 */
export interface IgnoreRule {
  /** The glob pattern */
  pattern: string;
  /** Where this rule came from */
  source: IgnoreSource;
}

/**
 * Result of checking whether a path is ignored.
 */
export interface IgnoreResult {
  ignored: boolean;
  source?: IgnoreSource;
}
