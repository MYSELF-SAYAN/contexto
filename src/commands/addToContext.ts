import * as vscode from 'vscode';
import { ContextManager } from '../core/contextManager.js';
import { extractPathFromArg } from '../utils/paths.js';
import { unignorePath } from './removeFromIgnore.js';
import { getSettings } from '../models/settings.js';

/**
 * Scans a folder recursively and adds all non-binary, non-ignored files.
 */
async function addFolderFilesRecursively(
  contextManager: ContextManager,
  folderAbsPath: string
): Promise<void> {
  const scanner = contextManager.getScanner();
  const workspaceRoot = contextManager.getWorkspaceRoot();
  const settings = getSettings();

  const entries = await scanner.scanDirectory(
    folderAbsPath,
    workspaceRoot,
    contextManager.getIgnoreEngine(),
    { maxFileSize: settings.maxFileSize }
  );

  const flatFiles = scanner.flattenFiles(entries);
  const paths = flatFiles
    .filter(e => !e.isBinary && e.included)
    .map(e => e.relativePath);

  contextManager.addFileBatch(paths);
}

/**
 * Adds a single file to the context from Explorer right-click or TreeView.
 */
export function addFileToContext(contextManager: ContextManager) {
  return async (arg?: any) => {
    const workspaceRoot = contextManager.getWorkspaceRoot();
    const target = extractPathFromArg(arg, workspaceRoot);

    if (!target) {
      vscode.window.showWarningMessage('Contexto: No file selected.');
      return;
    }

    const relPath = target.relativePath;
    const ignoreEngine = contextManager.getIgnoreEngine();
    const ignoreResult = ignoreEngine.isIgnored(relPath);

    if (ignoreResult.ignored) {
      const choice = await vscode.window.showWarningMessage(
        `"${relPath}" is ignored. To select this, you need to unignore it first.`,
        'Unignore & Select',
        'Unignore'
      );
      if (choice === 'Unignore & Select') {
        await unignorePath(contextManager, relPath, false);
        contextManager.addFile(relPath);
        vscode.window.showInformationMessage(`Contexto: Added to context: ${relPath}`);
      } else if (choice === 'Unignore') {
        await unignorePath(contextManager, relPath, false);
        vscode.window.showInformationMessage(`Contexto: Unignored "${relPath}"`);
      }
      return;
    }

    contextManager.addFile(relPath);
    vscode.window.showInformationMessage(`Contexto: Added to context: ${relPath}`);
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
    let folderAbsPath: string;

    if (target) {
      folderRelPath = target.relativePath;
      folderAbsPath = target.absolutePath;
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
      folderAbsPath = selected.absolutePath;
    }

    const ignoreEngine = contextManager.getIgnoreEngine();
    const ignoreResult = ignoreEngine.isDirectoryIgnored(folderRelPath);

    if (ignoreResult.ignored) {
      const choice = await vscode.window.showWarningMessage(
        `"${folderRelPath}" is ignored. To select this, you need to unignore it first.`,
        'Unignore & Select',
        'Unignore'
      );
      if (choice === 'Unignore & Select') {
        await unignorePath(contextManager, folderRelPath, true);
        contextManager.addFolder(folderRelPath);
        await addFolderFilesRecursively(contextManager, folderAbsPath);
        vscode.window.showInformationMessage(`Contexto: Added folder to context: ${folderRelPath}`);
      } else if (choice === 'Unignore') {
        await unignorePath(contextManager, folderRelPath, true);
        vscode.window.showInformationMessage(`Contexto: Unignored folder "${folderRelPath}" and its contents`);
      }
      return;
    }

    contextManager.addFolder(folderRelPath);
    await addFolderFilesRecursively(contextManager, folderAbsPath);
    vscode.window.showInformationMessage(`Contexto: Added folder to context: ${folderRelPath}`);
  };
}

/**
 * Adds the currently active editor's file.
 */
export function addActiveFileToContext(contextManager: ContextManager) {
  return async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Contexto: No active file.');
      return;
    }

    const workspaceRoot = contextManager.getWorkspaceRoot();
    const target = extractPathFromArg(editor.document.uri, workspaceRoot);
    if (target) {
      const relPath = target.relativePath;
      const ignoreEngine = contextManager.getIgnoreEngine();
      const ignoreResult = ignoreEngine.isIgnored(relPath);

      if (ignoreResult.ignored) {
        const choice = await vscode.window.showWarningMessage(
          `"${relPath}" is ignored. To select this, you need to unignore it first.`,
          'Unignore & Select',
          'Unignore'
        );
        if (choice === 'Unignore & Select') {
          await unignorePath(contextManager, relPath, false);
          contextManager.addFile(relPath);
          vscode.window.showInformationMessage(`Contexto: Added to context: ${relPath}`);
        } else if (choice === 'Unignore') {
          await unignorePath(contextManager, relPath, false);
          vscode.window.showInformationMessage(`Contexto: Unignored "${relPath}"`);
        }
        return;
      }

      contextManager.addFile(relPath);
      vscode.window.showInformationMessage(`Contexto: Added to context: ${relPath}`);
    }
  };
}

/**
 * Adds all currently open editors to the context, skipping any ignored files.
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
      vscode.window.showWarningMessage('Contexto: No open editors found.');
      return;
    }

    const ignoreEngine = contextManager.getIgnoreEngine();
    const allowedPaths: string[] = [];
    let ignoredCount = 0;

    for (const p of paths) {
      if (ignoreEngine.isIgnored(p).ignored) {
        ignoredCount++;
      } else {
        allowedPaths.push(p);
      }
    }

    if (allowedPaths.length === 0) {
      vscode.window.showWarningMessage(
        'Contexto: All open editor(s) are ignored. Unignore them first to add to context.'
      );
      return;
    }

    contextManager.addFiles(allowedPaths);
    if (ignoredCount > 0) {
      vscode.window.showInformationMessage(
        `Contexto: Added ${allowedPaths.length} open editor(s) to context (${ignoredCount} ignored file(s) skipped).`
      );
    } else {
      vscode.window.showInformationMessage(`Contexto: Added ${allowedPaths.length} open editor(s) to context.`);
    }
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
        title: 'Contexto: Selecting all workspace files...',
        cancellable: false,
      },
      async () => {
        await contextManager.selectAll();
      }
    );
    const count = contextManager.getFileCount();
    vscode.window.showInformationMessage(`Contexto: Selected all ${count} workspace files.`);
  };
}
