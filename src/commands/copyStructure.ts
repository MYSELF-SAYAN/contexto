import * as vscode from 'vscode';
import { ContextManager } from '../core/contextManager.js';
import { Scanner } from '../core/scanner.js';
import { buildTreeString, buildPathList } from '../core/treeBuilder.js';
import { readFiles } from '../core/fileReader.js';
import { MarkdownGenerator, GeneratorInput } from '../generators/markdownGenerator.js';
import { XmlGenerator } from '../generators/xmlGenerator.js';
import { TextGenerator } from '../generators/textGenerator.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { extractPathFromArg } from '../utils/paths.js';
import { getSettings } from '../models/settings.js';
import { OutputFormat } from '../models/context.js';

const scanner = new Scanner();
const markdownGen = new MarkdownGenerator();
const xmlGen = new XmlGenerator();
const textGen = new TextGenerator();

/**
 * Generates content in the specified format.
 */
function generateInFormat(input: GeneratorInput, format: OutputFormat): string {
  switch (format) {
    case OutputFormat.XML:
      return xmlGen.generate(input);
    case OutputFormat.PlainText:
      return textGen.generate(input);
    case OutputFormat.Markdown:
    default:
      return markdownGen.generate(input);
  }
}

/**
 * Returns a human-readable label for an output format.
 */
function formatLabel(format: OutputFormat): string {
  switch (format) {
    case OutputFormat.XML:
      return 'XML';
    case OutputFormat.PlainText:
      return 'Plain Text';
    case OutputFormat.Markdown:
      return 'Markdown';
    default:
      return String(format);
  }
}

/**
 * Copies the directory structure of the current context selection.
 */
export function copyStructure(contextManager: ContextManager) {
  return async () => {
    try {
      if (contextManager.isEmpty()) {
        vscode.window.showWarningMessage('Context is empty. Select files or folders using the checkboxes first.');
        return;
      }

      const workspaceRoot = contextManager.getWorkspaceRoot();
      const rootName = workspaceRoot.split(/[\\/]/).pop() || 'workspace';
      const tree = await contextManager.resolveTree();
      const settings = getSettings();
      const treeBody = buildTreeString(tree, { rootName, depth: settings.treeDepth });
      const formatted = `Directory structure:\n${treeBody}`;
      await copyToClipboard(formatted, 'Directory structure copied to clipboard.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`CodeDigest: Failed to copy structure — ${message}`);
    }
  };
}

/**
 * Copies the structure of a specific folder (from Explorer right-click or TreeView).
 */
export function copyFolderStructure(contextManager: ContextManager) {
  return async (arg?: any) => {
    try {
      const workspaceRoot = contextManager.getWorkspaceRoot();
      const target = extractPathFromArg(arg, workspaceRoot);

      if (!target) {
        vscode.window.showWarningMessage('No folder selected.');
        return;
      }

      const ignoreEngine = contextManager.getIgnoreEngine();
      const settings = getSettings();

      const entries = await scanner.scanDirectory(
        target.absolutePath,
        workspaceRoot,
        ignoreEngine,
        { maxDepth: settings.treeDepth, maxFileSize: settings.maxFileSize }
      );

      const treeBody = buildTreeString(entries, { rootName: target.relativePath, depth: settings.treeDepth });
      const formatted = `Directory structure:\n${treeBody}`;
      await copyToClipboard(formatted, 'Folder structure copied to clipboard.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`CodeDigest: Failed to copy folder structure — ${message}`);
    }
  };
}

/**
 * Copies the full workspace structure.
 */
export function copyWorkspaceStructure(contextManager: ContextManager) {
  return async () => {
    try {
      const workspaceRoot = contextManager.getWorkspaceRoot();
      const ignoreEngine = contextManager.getIgnoreEngine();
      const settings = getSettings();

      const entries = await scanner.scanDirectory(
        workspaceRoot,
        workspaceRoot,
        ignoreEngine,
        { maxDepth: settings.treeDepth, maxFileSize: settings.maxFileSize }
      );

      const rootName = workspaceRoot.split(/[\\/]/).pop() || 'workspace';
      const treeBody = buildTreeString(entries, { rootName, depth: settings.treeDepth });
      const formatted = `Directory structure:\n${treeBody}`;
      await copyToClipboard(formatted, 'Workspace structure copied to clipboard.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`CodeDigest: Failed to copy workspace structure — ${message}`);
    }
  };
}

/**
 * Copies the generated prompt to clipboard using the current format.
 */
export function copyPrompt(contextManager: ContextManager) {
  return async () => {
    if (contextManager.isEmpty()) {
      vscode.window.showWarningMessage('Context is empty. Select files or folders using the checkboxes first.');
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Generating context...',
        cancellable: false,
      },
      async () => {
        try {
          const settings = getSettings();
          const workspaceRoot = contextManager.getWorkspaceRoot();
          const rootName = workspaceRoot.split(/[\\/]/).pop() || 'workspace';

          const { entries } = await contextManager.resolveSelection();
          const tree = await contextManager.resolveTree();
          const treeString = buildTreeString(tree, { rootName, depth: settings.treeDepth });

          const includedPaths = entries.filter(e => e.included).map(e => e.absolutePath);
          const readResult = await readFiles(includedPaths, workspaceRoot, settings.maxFileSize, settings.includeEmptyLines);

          const input: GeneratorInput = {
            instructions: contextManager.getInstructions(),
            treeString,
            files: readResult.files,
            skipped: readResult.skipped,
            includeTree: settings.includeTree,
            includeFileContents: settings.includeFileContents,
          };

          const format = contextManager.getOutputFormat();
          const content = generateInFormat(input, format);
          const label = formatLabel(format);

          await copyToClipboard(content, `Context copied as ${label} (${readResult.files.length} files).`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`CodeDigest: Failed to copy prompt — ${message}`);
        }
      }
    );
  };
}

/**
 * Copies the generated prompt with a format selector QuickPick.
 * Default selection is XML.
 */
export function copyPromptAs(contextManager: ContextManager) {
  return async () => {
    if (contextManager.isEmpty()) {
      vscode.window.showWarningMessage('Context is empty. Select files or folders using the checkboxes first.');
      return;
    }

    const currentFormat = contextManager.getOutputFormat();

    const items: vscode.QuickPickItem[] = [
      {
        label: '$(file-code) XML',
        description: currentFormat === OutputFormat.XML ? '(current)' : '',
        detail: 'CDATA sections, safe for embedding',
      },
      {
        label: '$(markdown) Markdown',
        description: currentFormat === OutputFormat.Markdown ? '(current)' : '',
        detail: 'Fenced code blocks with language identifiers',
      },
      {
        label: '$(file-text) Plain Text',
        description: currentFormat === OutputFormat.PlainText ? '(current)' : '',
        detail: 'Simple separator-based formatting',
      },
    ];

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select output format to copy',
      title: 'CodeDigest: Copy Prompt As...',
    });

    if (!picked) { return; }

    let format: OutputFormat;
    if (picked.label.includes('XML')) {
      format = OutputFormat.XML;
    } else if (picked.label.includes('Markdown')) {
      format = OutputFormat.Markdown;
    } else {
      format = OutputFormat.PlainText;
    }

    // Update the output format for future operations
    contextManager.setOutputFormat(format);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Generating context as ${formatLabel(format)}...`,
        cancellable: false,
      },
      async () => {
        try {
          const settings = getSettings();
          const workspaceRoot = contextManager.getWorkspaceRoot();
          const rootName = workspaceRoot.split(/[\\/]/).pop() || 'workspace';

          const { entries } = await contextManager.resolveSelection();
          const tree = await contextManager.resolveTree();
          const treeString = buildTreeString(tree, { rootName, depth: settings.treeDepth });

          const includedPaths = entries.filter(e => e.included).map(e => e.absolutePath);
          const readResult = await readFiles(includedPaths, workspaceRoot, settings.maxFileSize, settings.includeEmptyLines);

          const input: GeneratorInput = {
            instructions: contextManager.getInstructions(),
            treeString,
            files: readResult.files,
            skipped: readResult.skipped,
            includeTree: settings.includeTree,
            includeFileContents: settings.includeFileContents,
          };

          const content = generateInFormat(input, format);
          await copyToClipboard(content, `Context copied as ${formatLabel(format)} (${readResult.files.length} files).`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`CodeDigest: Failed to copy prompt — ${message}`);
        }
      }
    );
  };
}

/**
 * Copies workspace-relative paths of selected files to clipboard.
 */
export function copyPaths(contextManager: ContextManager) {
  return async () => {
    try {
      if (contextManager.isEmpty()) {
        vscode.window.showWarningMessage('Context is empty. Select files or folders using the checkboxes first.');
        return;
      }

      const { entries } = await contextManager.resolveSelection();
      const paths = entries.filter(e => e.included).map(e => e.relativePath);
      const text = paths.join('\n');
      await copyToClipboard(text, `${paths.length} path(s) copied to clipboard.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`CodeDigest: Failed to copy paths — ${message}`);
    }
  };
}

/**
 * Copies folder paths to clipboard (from Explorer right-click or TreeView).
 */
export function copyFolderPaths(contextManager: ContextManager) {
  return async (arg?: any) => {
    try {
      const workspaceRoot = contextManager.getWorkspaceRoot();
      const target = extractPathFromArg(arg, workspaceRoot);

      if (!target) {
        vscode.window.showWarningMessage('No folder selected.');
        return;
      }

      const ignoreEngine = contextManager.getIgnoreEngine();
      const settings = getSettings();

      const entries = await scanner.scanDirectory(
        target.absolutePath,
        workspaceRoot,
        ignoreEngine,
        { maxDepth: settings.treeDepth, maxFileSize: settings.maxFileSize }
      );

      const paths = buildPathList(entries);
      const text = paths.join('\n');
      await copyToClipboard(text, `${paths.length} path(s) copied to clipboard.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`CodeDigest: Failed to copy folder paths — ${message}`);
    }
  };
}

/**
 * Quick "Copy Context" from Explorer or TreeView — generates and copies in the current format.
 */
export function copyContext(contextManager: ContextManager) {
  return async (arg?: any) => {
    try {
      const workspaceRoot = contextManager.getWorkspaceRoot();
      const target = extractPathFromArg(arg, workspaceRoot);
      if (!target) { return; }

      const settings = getSettings();
      const readResult = await readFiles([target.absolutePath], workspaceRoot, settings.maxFileSize, settings.includeEmptyLines);

      const input: GeneratorInput = {
        instructions: '',
        treeString: target.relativePath,
        files: readResult.files,
        skipped: readResult.skipped,
        includeTree: true,
        includeFileContents: true,
      };

      const format = contextManager.getOutputFormat();
      const content = generateInFormat(input, format);
      await copyToClipboard(content, `Context copied as ${formatLabel(format)}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`CodeDigest: Failed to copy context — ${message}`);
    }
  };
}

/**
 * Quick "Copy Folder Context" from Explorer or TreeView — generates context for a folder in the current format.
 */
export function copyFolderContext(contextManager: ContextManager) {
  return async (arg?: any) => {
    try {
      const workspaceRoot = contextManager.getWorkspaceRoot();
      const target = extractPathFromArg(arg, workspaceRoot);
      if (!target) { return; }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Generating folder context...',
          cancellable: false,
        },
        async () => {
          const settings = getSettings();
          const ignoreEngine = contextManager.getIgnoreEngine();

          const entries = await scanner.scanDirectory(
            target.absolutePath,
            workspaceRoot,
            ignoreEngine,
            { maxDepth: settings.treeDepth, maxFileSize: settings.maxFileSize }
          );

          const flat = scanner.flattenFiles(entries);
          const includedPaths = flat.filter(e => e.included).map(e => e.absolutePath);

          const treeString = buildTreeString(entries, { rootName: target.relativePath, depth: settings.treeDepth });
          const readResult = await readFiles(includedPaths, workspaceRoot, settings.maxFileSize, settings.includeEmptyLines);

          const input: GeneratorInput = {
            instructions: '',
            treeString,
            files: readResult.files,
            skipped: readResult.skipped,
            includeTree: true,
            includeFileContents: true,
          };

          const format = contextManager.getOutputFormat();
          const content = generateInFormat(input, format);
          await copyToClipboard(content, `Folder context copied as ${formatLabel(format)} (${readResult.files.length} files).`);
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`CodeDigest: Failed to copy folder context — ${message}`);
    }
  };
}
