import { IgnoreRule } from './ignoreRule.js';

/**
 * Output format for generated context.
 */
export enum OutputFormat {
  Markdown = 'markdown',
  XML = 'xml',
  PlainText = 'plaintext',
}

/**
 * User's current file/folder selection.
 */
export interface Selection {
  /** Workspace-relative paths of selected files */
  files: string[];
  /** Workspace-relative paths of selected folders */
  folders: string[];
  /** Paths explicitly included (overrides ignore rules) */
  explicitIncludes: string[];
}

/**
 * The full context model combining selection, rules, and options.
 */
export interface Context {
  workspaceRoot: string;
  selection: Selection;
  ignoreRules: IgnoreRule[];
  instructions: string;
  outputFormat: OutputFormat;
  includeTree: boolean;
  includeFileContents: boolean;
}

/**
 * Summary statistics for the current context.
 */
export interface ContextSummary {
  included: number;
  ignored: number;
  binary: number;
  large: number;
  sensitive: number;
  total: number;
  lines: number;
  characters: number;
  estimatedTokens: number;
}

/**
 * Creates an empty selection.
 */
export function createEmptySelection(): Selection {
  return {
    files: [],
    folders: [],
    explicitIncludes: [],
  };
}

/**
 * Creates an empty context summary.
 */
export function createEmptySummary(): ContextSummary {
  return {
    included: 0,
    ignored: 0,
    binary: 0,
    large: 0,
    sensitive: 0,
    total: 0,
    lines: 0,
    characters: 0,
    estimatedTokens: 0,
  };
}
