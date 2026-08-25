import * as vscode from 'vscode';
import { ContextManager } from './core/contextManager.js';
import { ContextTreeProvider } from './ui/contextTreeProvider.js';
import { PreviewPanel } from './ui/previewPanel.js';
import { StatusBar } from './ui/statusBar.js';
import {
  addFileToContext,
  addFolderToContext,
  addActiveFileToContext,
  addOpenEditorsToContext,
  addWorkspaceToContext,
} from './commands/addToContext.js';
import { removeFromContext, clearContext } from './commands/removeFromContext.js';
import { ignoreInContext, ignoreFolderInContext } from './commands/ignoreInContext.js';
import { removeFromIgnore } from './commands/removeFromIgnore.js';
import { generatePrompt, triggerLivePreviewUpdate } from './commands/generatePrompt.js';
import {
  copyStructure,
  copyFolderStructure,
  copyWorkspaceStructure,
  copyPrompt,
  copyPromptAs,
  copyPaths,
  copyFolderPaths,
  copyContext,
  copyFolderContext,
} from './commands/copyStructure.js';
import { exportContext } from './commands/exportContext.js';

let contextManager: ContextManager | undefined;
let statusBar: StatusBar | undefined;
let previewPanel: PreviewPanel | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Require a workspace
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    // Register a subset of commands that show a warning
    const noWorkspace = () => {
      vscode.window.showWarningMessage('CodeDigest requires an open workspace.');
    };
    context.subscriptions.push(
      vscode.commands.registerCommand('codeDigest.open', noWorkspace),
      vscode.commands.registerCommand('codeDigest.addFile', noWorkspace),
      vscode.commands.registerCommand('codeDigest.addFolder', noWorkspace),
      vscode.commands.registerCommand('codeDigest.addActiveFile', noWorkspace),
      vscode.commands.registerCommand('codeDigest.addOpenEditors', noWorkspace),
      vscode.commands.registerCommand('codeDigest.addWorkspace', noWorkspace),
      vscode.commands.registerCommand('codeDigest.generatePrompt', noWorkspace),
      vscode.commands.registerCommand('codeDigest.copyStructure', noWorkspace),
      vscode.commands.registerCommand('codeDigest.copyPrompt', noWorkspace),
      vscode.commands.registerCommand('codeDigest.copyPromptAs', noWorkspace),
      vscode.commands.registerCommand('codeDigest.copyPaths', noWorkspace),
      vscode.commands.registerCommand('codeDigest.clearContext', noWorkspace),
      vscode.commands.registerCommand('codeDigest.exportContext', noWorkspace),
      vscode.commands.registerCommand('codeDigest.removeFile', noWorkspace),
      vscode.commands.registerCommand('codeDigest.ignoreFile', noWorkspace),
      vscode.commands.registerCommand('codeDigest.ignoreFolder', noWorkspace),
      vscode.commands.registerCommand('codeDigest.removeFromIgnore', noWorkspace),
      vscode.commands.registerCommand('codeDigest.copyFolderStructure', noWorkspace),
      vscode.commands.registerCommand('codeDigest.copyWorkspaceStructure', noWorkspace),
      vscode.commands.registerCommand('codeDigest.copyFolderPaths', noWorkspace),
      vscode.commands.registerCommand('codeDigest.copyContext', noWorkspace),
      vscode.commands.registerCommand('codeDigest.copyFolderContext', noWorkspace),
      vscode.commands.registerCommand('codeDigest.refreshContext', noWorkspace),
    );
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;

  // Initialize core
  contextManager = new ContextManager(workspaceRoot);
  await contextManager.initialize();

  // Initialize UI — tree provider shows full workspace with checkboxes
  const treeProvider = new ContextTreeProvider(
    contextManager,
    contextManager.getIgnoreEngine(),
    workspaceRoot
  );

  const treeView = vscode.window.createTreeView('codeDigest.contextView', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  // Wire up checkbox change events — this is the primary selection mechanism
  treeView.onDidChangeCheckboxState(async (e) => {
    await treeProvider.handleCheckboxChange(e.items);
  });

  statusBar = new StatusBar(contextManager);

  // Register commands
  const cm = contextManager;
  const extUri = context.extensionUri;

  // Auto update live preview when context changes (if preview panel is open)
  cm.onDidChange(() => {
    triggerLivePreviewUpdate(cm, extUri);
    treeProvider.setIgnoreEngine(cm.getIgnoreEngine());
    treeProvider.refresh();
  });

  context.subscriptions.push(
    treeView,
    contextManager,
    statusBar,

    // Open sidebar
    vscode.commands.registerCommand('codeDigest.open', () => {
      vscode.commands.executeCommand('codeDigest.contextView.focus');
    }),

    // Add commands
    vscode.commands.registerCommand('codeDigest.addFile', addFileToContext(cm)),
    vscode.commands.registerCommand('codeDigest.addFolder', addFolderToContext(cm)),
    vscode.commands.registerCommand('codeDigest.addActiveFile', addActiveFileToContext(cm)),
    vscode.commands.registerCommand('codeDigest.addOpenEditors', addOpenEditorsToContext(cm)),
    vscode.commands.registerCommand('codeDigest.addWorkspace', addWorkspaceToContext(cm)),

    // Remove commands
    vscode.commands.registerCommand('codeDigest.removeFile', removeFromContext(cm)),
    vscode.commands.registerCommand('codeDigest.clearContext', clearContext(cm)),

    // Ignore commands
    vscode.commands.registerCommand('codeDigest.ignoreFile', ignoreInContext(cm)),
    vscode.commands.registerCommand('codeDigest.ignoreFolder', ignoreFolderInContext(cm)),
    vscode.commands.registerCommand('codeDigest.removeFromIgnore', removeFromIgnore(cm)),

    // Generate & preview
    vscode.commands.registerCommand('codeDigest.generatePrompt', generatePrompt(cm, extUri)),

    // Copy commands
    vscode.commands.registerCommand('codeDigest.copyStructure', copyStructure(cm)),
    vscode.commands.registerCommand('codeDigest.copyFolderStructure', copyFolderStructure(cm)),
    vscode.commands.registerCommand('codeDigest.copyWorkspaceStructure', copyWorkspaceStructure(cm)),
    vscode.commands.registerCommand('codeDigest.copyPrompt', copyPrompt(cm)),
    vscode.commands.registerCommand('codeDigest.copyPromptAs', copyPromptAs(cm)),
    vscode.commands.registerCommand('codeDigest.copyPaths', copyPaths(cm)),
    vscode.commands.registerCommand('codeDigest.copyFolderPaths', copyFolderPaths(cm)),
    vscode.commands.registerCommand('codeDigest.copyContext', copyContext(cm)),
    vscode.commands.registerCommand('codeDigest.copyFolderContext', copyFolderContext(cm)),

    // Export
    vscode.commands.registerCommand('codeDigest.exportContext', exportContext(cm)),

    // Refresh
    vscode.commands.registerCommand('codeDigest.refreshContext', () => {
      treeProvider.refresh();
    }),

    // Reload ignore engine on settings change
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('codeDigest')) {
        if (!cm.suppressConfigReload) {
          await cm.reloadIgnoreEngine();
        }
        treeProvider.setIgnoreEngine(cm.getIgnoreEngine());
        treeProvider.refresh();
      }
    }),
  );
}

export function deactivate(): void {
  previewPanel?.dispose();
  statusBar?.dispose();
  contextManager?.dispose();
}
