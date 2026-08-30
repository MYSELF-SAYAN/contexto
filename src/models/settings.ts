import * as vscode from 'vscode';
import { OutputFormat } from './context.js';

/**
 * Typed representation of all contexto.* settings.
 */
export interface ExtensionSettings {
  respectGitignore: boolean;
  useContextignore: boolean;
  ignore: string[];
  explicitIncludes: string[];
  defaultFormat: OutputFormat;
  maxFileSize: number;
  includeTree: boolean;
  includeFileContents: boolean;
  includeEmptyLines: boolean;
  treeDepth: number;
}

/**
 * Reads current extension settings from VS Code configuration.
 */
export function getSettings(): ExtensionSettings {
  const config = vscode.workspace.getConfiguration('contexto');

  const formatStr = config.get<string>('defaultFormat', 'xml');
  let defaultFormat: OutputFormat;
  switch (formatStr) {
    case 'markdown':
      defaultFormat = OutputFormat.Markdown;
      break;
    case 'plaintext':
      defaultFormat = OutputFormat.PlainText;
      break;
    default:
      defaultFormat = OutputFormat.XML;
  }

  return {
    respectGitignore: config.get<boolean>('respectGitignore', true),
    useContextignore: config.get<boolean>('useContextignore', true),
    ignore: config.get<string[]>('ignore', []),
    explicitIncludes: config.get<string[]>('explicitIncludes', []),
    defaultFormat,
    maxFileSize: config.get<number>('maxFileSize', 1048576),
    includeTree: config.get<boolean>('includeTree', true),
    includeFileContents: config.get<boolean>('includeFileContents', true),
    includeEmptyLines: config.get<boolean>('includeEmptyLines', true),
    treeDepth: config.get<number>('treeDepth', 0),
  };
}
