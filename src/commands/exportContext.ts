import * as vscode from 'vscode';
import { ContextManager } from '../core/contextManager.js';
import { readFiles } from '../core/fileReader.js';
import { buildTreeString } from '../core/treeBuilder.js';
import { MarkdownGenerator, GeneratorInput } from '../generators/markdownGenerator.js';
import { XmlGenerator } from '../generators/xmlGenerator.js';
import { TextGenerator } from '../generators/textGenerator.js';
import { OutputFormat } from '../models/context.js';
import { getSettings } from '../models/settings.js';

const markdownGen = new MarkdownGenerator();
const xmlGen = new XmlGenerator();
const textGen = new TextGenerator();

/**
 * Exports the generated context to a file.
 * Opens VS Code save dialog with format-appropriate filename.
 */
export function exportContext(contextManager: ContextManager) {
  return async () => {
    if (contextManager.isEmpty()) {
      vscode.window.showWarningMessage('Context is empty. Select files or folders using the checkboxes first.');
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Generating context for export...',
        cancellable: false,
      },
      async () => {
        try {
          const settings = getSettings();
          const workspaceRoot = contextManager.getWorkspaceRoot();
          const rootName = workspaceRoot.split(/[\\/]/).pop() || 'workspace';
          const format = contextManager.getOutputFormat();

          // Resolve and read
          const { entries } = await contextManager.resolveSelection();
          const tree = await contextManager.resolveTree();
          const treeString = buildTreeString(tree, { rootName, depth: settings.treeDepth });

          const includedPaths = entries.filter(e => e.included).map(e => e.absolutePath);
          const readResult = await readFiles(
            includedPaths,
            workspaceRoot,
            settings.maxFileSize,
            settings.includeEmptyLines
          );

          const input: GeneratorInput = {
            instructions: contextManager.getInstructions(),
            treeString,
            files: readResult.files,
            skipped: readResult.skipped,
            includeTree: settings.includeTree,
            includeFileContents: settings.includeFileContents,
          };

          // Generate
          let content: string;
          let ext: string;
          switch (format) {
            case OutputFormat.XML:
              content = xmlGen.generate(input);
              ext = 'xml';
              break;
            case OutputFormat.PlainText:
              content = textGen.generate(input);
              ext = 'txt';
              break;
            default:
              content = markdownGen.generate(input);
              ext = 'md';
          }

          // Save dialog
          const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`context.${ext}`),
            filters: {
              'Context Files': [ext],
              'All Files': ['*'],
            },
          });

          if (uri) {
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
            vscode.window.showInformationMessage(`Context exported to ${uri.fsPath}`);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Contexto: Failed to export — ${message}`);
        }
      }
    );
  };
}
