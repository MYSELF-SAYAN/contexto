import * as vscode from 'vscode';
import { ContextManager } from '../core/contextManager.js';
import { extractPathFromArg } from '../utils/paths.js';

/**
 * Adds a single file to the context from Explorer right-click or TreeView.
 */
export function addFileToContext(contextManager: ContextManager) {
  return async (arg?: any) => {
    const workspaceRoot = contextManager.getWorkspaceRoot();
    const target = extractPathFromArg(arg, workspaceRoot);

    if (!target) {
      vscode.window.showWarningMessage('No file selected.');
      return;
    }

    contextManager.addFile(target.relativePath);
    vscode.window.showInformationMessage(`Added to context: ${target.relativePath}`);
  };
}

/**
 * Adds a folder recursively to the context.
 */
export function addFolderToContext(contextManager: ContextManager) {
  return async (arg?: any) => {
    const workspaceRoot = contextManager.getWorkspaceRoot();
    const target = extractPathFromArg(arg, workspaceRoot);

    let folderRelPath: string;

    if (target) {
      folderRelPath = target.relativePath;
    } else {
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Add Folder to Context',
      });
      if (!uris || uris.length === 0) {return;}
      const selected = extractPathFromArg(uris[0], workspaceRoot);
      if (!selected) {return;}
      folderRelPath = selected.relativePath;
    }

    contextManager.addFolder(folderRelPath);
    vscode.window.showInformationMessage(`Added folder to context: ${folderRelPath}`);
  };
}

/**
 * Adds the currently active editor's file.
 */
export function addActiveFileToContext(contextManager: ContextManager) {
  return async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active file.');
      return;
    }

    const workspaceRoot = contextManager.getWorkspaceRoot();
    const target = extractPathFromArg(editor.document.uri, workspaceRoot);
    if (target) {
      contextManager.addFile(target.relativePath);
      vscode.window.showInformationMessage(`Added to context: ${target.relativePath}`);
    }
  };
}

/**
 * Adds all currently open editors to the context.
 */
export function addOpenEditorsToContext(contextManager: ContextManager) {
  return async () => {
    const workspaceRoot = contextManager.getWorkspaceRoot();
    const tabGroups = vscode.window.tabGroups.all;
    const paths: string[] = [];

    for (const group of tabGroups) {
      for (const tab of group.tabs) {
        if (tab.input instanceof vscode.TabInputText) {
          const target = extractPathFromArg(tab.input.uri, workspaceRoot);
          if (target) {
            paths.push(target.relativePath);
          }
        }
      }
    }

    if (paths.length === 0) {
      vscode.window.showWarningMessage('No open editors found.');
      return;
    }

    contextManager.addFiles(paths);
    vscode.window.showInformationMessage(`Added ${paths.length} open editor(s) to context.`);
  };
}

/**
 * Selects all non-ignored files in the workspace.
 */
export function addWorkspaceToContext(contextManager: ContextManager) {
  return async () => {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Selecting all workspace files...',
        cancellable: false,
      },
      async () => {
        await contextManager.selectAll();
      }
    );
    const count = contextManager.getFileCount();
    vscode.window.showInformationMessage(`Selected all ${count} workspace files.`);
  };
}
