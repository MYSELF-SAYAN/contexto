import * as vscode from 'vscode';
import { ContextManager } from '../core/contextManager.js';
import { readFiles } from '../core/fileReader.js';
import { buildTreeString } from '../core/treeBuilder.js';
import { computeStats, TokenStats } from '../core/tokenCounter.js';
import { MarkdownGenerator, GeneratorInput } from '../generators/markdownGenerator.js';
import { XmlGenerator } from '../generators/xmlGenerator.js';
import { TextGenerator } from '../generators/textGenerator.js';
import { PreviewPanel } from '../ui/previewPanel.js';
import { OutputFormat } from '../models/context.js';
import { getSettings } from '../models/settings.js';
import { copyToClipboard } from '../utils/clipboard.js';

const markdownGen = new MarkdownGenerator();
const xmlGen = new XmlGenerator();
const textGen = new TextGenerator();

let liveUpdateTimer: NodeJS.Timeout | undefined;

/**
 * Builds contents for all formats given the current context selection.
 */
async function buildContextContents(contextManager: ContextManager) {
  const settings = getSettings();
  const workspaceRoot = contextManager.getWorkspaceRoot();
  const rootName = workspaceRoot.split(/[\\/]/).pop() || 'workspace';

  // Resolve selection
  const { entries, summary } = await contextManager.resolveSelection();

  // Build tree with rootName
  const tree = await contextManager.resolveTree();
  const treeString = buildTreeString(tree, {
    rootName,
    depth: settings.treeDepth,
  });

  // Read file contents
  const includedPaths = entries
    .filter(e => e.included)
    .map(e => e.absolutePath);

  const readResult = await readFiles(
    includedPaths,
    workspaceRoot,
    settings.maxFileSize,
    settings.includeEmptyLines
  );

  // Generate all three formats
  const input: GeneratorInput = {
    instructions: contextManager.getInstructions(),
    treeString,
    files: readResult.files,
    skipped: readResult.skipped,
    includeTree: settings.includeTree,
    includeFileContents: settings.includeFileContents,
  };

  const contents: Record<string, string> = {
    markdown: markdownGen.generate(input),
    xml: xmlGen.generate(input),
    plaintext: textGen.generate(input),
  };

  const activeFormat = contextManager.getOutputFormat();
  const activeContent = contents[activeFormat] || contents.xml;
  const stats = computeStats(activeContent, readResult.files.length);

  return { contents, stats, summary, activeFormat };
}

/**
 * Generates the prompt and opens the preview panel.
 */
export function generatePrompt(contextManager: ContextManager, extensionUri: vscode.Uri) {
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
          const { contents, stats, summary, activeFormat } = await buildContextContents(contextManager);

          // Show preview
          const preview = PreviewPanel.getInstance(extensionUri);

          preview.onCopy = (format: string) => {
            const text = contents[format] || '';
            copyToClipboard(text, 'Context copied to clipboard.');
          };

          preview.onExport = (format: string) => {
            exportGeneratedContent(contents[format] || '', format);
          };

          preview.onRefresh = () => {
            vscode.commands.executeCommand('contexto.generatePrompt');
          };

          preview.onFormatChange = (format: string) => {
            const f = format as OutputFormat;
            if (Object.values(OutputFormat).includes(f)) {
              contextManager.setOutputFormat(f);
            }
          };

          preview.show(contents, stats, activeFormat);

          vscode.window.showInformationMessage(
            `Context generated: ${summary.included} files included (~${stats.estimatedTokens.toLocaleString()} tokens)`
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Contexto: Failed to generate prompt — ${message}`);
        }
      }
    );
  };
}

/**
 * Debounced live preview update when selections change and preview is open.
 */
export function triggerLivePreviewUpdate(contextManager: ContextManager, extensionUri: vscode.Uri): void {
  const preview = PreviewPanel.getInstance(extensionUri);
  if (!preview.isOpen()) {
    return;
  }

  if (liveUpdateTimer) {
    clearTimeout(liveUpdateTimer);
  }

  liveUpdateTimer = setTimeout(async () => {
    try {
      if (contextManager.isEmpty()) {
        preview.update({ markdown: '', xml: '', plaintext: '' }, { files: 0, lines: 0, characters: 0, estimatedTokens: 0 }, contextManager.getOutputFormat());
        return;
      }
      const { contents, stats, activeFormat } = await buildContextContents(contextManager);
      preview.update(contents, stats, activeFormat);
    } catch {
      // Ignore background refresh errors
    }
  }, 120);
}

async function exportGeneratedContent(content: string, format: string): Promise<void> {
  const extMap: Record<string, string> = {
    markdown: 'md',
    xml: 'xml',
    plaintext: 'txt',
  };

  const ext = extMap[format] || 'txt';

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
}
