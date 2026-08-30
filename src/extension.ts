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
      vscode.window.showWarningMessage('Contexto requires an open workspace.');
    };
    context.subscriptions.push(
      vscode.commands.registerCommand('contexto.open', noWorkspace),
      vscode.commands.registerCommand('contexto.addFile', noWorkspace),
      vscode.commands.registerCommand('contexto.addFolder', noWorkspace),
      vscode.commands.registerCommand('contexto.addActiveFile', noWorkspace),
      vscode.commands.registerCommand('contexto.addOpenEditors', noWorkspace),
      vscode.commands.registerCommand('contexto.addWorkspace', noWorkspace),
      vscode.commands.registerCommand('contexto.generatePrompt', noWorkspace),
      vscode.commands.registerCommand('contexto.copyStructure', noWorkspace),
      vscode.commands.registerCommand('contexto.copyPrompt', noWorkspace),
      vscode.commands.registerCommand('contexto.copyPromptAs', noWorkspace),
      vscode.commands.registerCommand('contexto.copyPaths', noWorkspace),
      vscode.commands.registerCommand('contexto.clearContext', noWorkspace),
      vscode.commands.registerCommand('contexto.exportContext', noWorkspace),
      vscode.commands.registerCommand('contexto.removeFile', noWorkspace),
      vscode.commands.registerCommand('contexto.ignoreFile', noWorkspace),
      vscode.commands.registerCommand('contexto.ignoreFolder', noWorkspace),
      vscode.commands.registerCommand('contexto.removeFromIgnore', noWorkspace),
      vscode.commands.registerCommand('contexto.copyFolderStructure', noWorkspace),
      vscode.commands.registerCommand('contexto.copyWorkspaceStructure', noWorkspace),
      vscode.commands.registerCommand('contexto.copyFolderPaths', noWorkspace),
      vscode.commands.registerCommand('contexto.copyContext', noWorkspace),
      vscode.commands.registerCommand('contexto.copyFolderContext', noWorkspace),
      vscode.commands.registerCommand('contexto.refreshContext', noWorkspace),
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

  const treeView = vscode.window.createTreeView('contexto.contextView', {
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
    vscode.commands.registerCommand('contexto.open', () => {
      vscode.commands.executeCommand('contexto.contextView.focus');
    }),

    // Add commands
    vscode.commands.registerCommand('contexto.addFile', addFileToContext(cm)),
    vscode.commands.registerCommand('contexto.addFolder', addFolderToContext(cm)),
    vscode.commands.registerCommand('contexto.addActiveFile', addActiveFileToContext(cm)),
    vscode.commands.registerCommand('contexto.addOpenEditors', addOpenEditorsToContext(cm)),
    vscode.commands.registerCommand('contexto.addWorkspace', addWorkspaceToContext(cm)),

    // Remove commands
    vscode.commands.registerCommand('contexto.removeFile', removeFromContext(cm)),
    vscode.commands.registerCommand('contexto.clearContext', clearContext(cm)),

    // Ignore commands
    vscode.commands.registerCommand('contexto.ignoreFile', ignoreInContext(cm)),
    vscode.commands.registerCommand('contexto.ignoreFolder', ignoreFolderInContext(cm)),
    vscode.commands.registerCommand('contexto.removeFromIgnore', removeFromIgnore(cm)),

    // Generate & preview
    vscode.commands.registerCommand('contexto.generatePrompt', generatePrompt(cm, extUri)),

    // Copy commands
    vscode.commands.registerCommand('contexto.copyStructure', copyStructure(cm)),
    vscode.commands.registerCommand('contexto.copyFolderStructure', copyFolderStructure(cm)),
    vscode.commands.registerCommand('contexto.copyWorkspaceStructure', copyWorkspaceStructure(cm)),
    vscode.commands.registerCommand('contexto.copyPrompt', copyPrompt(cm)),
    vscode.commands.registerCommand('contexto.copyPromptAs', copyPromptAs(cm)),
    vscode.commands.registerCommand('contexto.copyPaths', copyPaths(cm)),
    vscode.commands.registerCommand('contexto.copyFolderPaths', copyFolderPaths(cm)),
    vscode.commands.registerCommand('contexto.copyContext', copyContext(cm)),
    vscode.commands.registerCommand('contexto.copyFolderContext', copyFolderContext(cm)),

    // Export
    vscode.commands.registerCommand('contexto.exportContext', exportContext(cm)),

    // Refresh
    vscode.commands.registerCommand('contexto.refreshContext', () => {
      treeProvider.refresh();
    }),

    // Reload ignore engine on settings change
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('contexto')) {
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
