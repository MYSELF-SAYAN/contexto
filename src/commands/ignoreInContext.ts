import * as vscode from 'vscode';
import { ContextManager } from '../core/contextManager.js';
import { extractPathFromArg, normalizePath } from '../utils/paths.js';

/**
 * Ignores a file in context.
 * Click the eye button → immediately adds exact path to ignore list.
 * No QuickPick, no pattern selection — just works.
 */
export function ignoreInContext(contextManager: ContextManager) {
  return async (arg?: any) => {
    try {
      const workspaceRoot = contextManager.getWorkspaceRoot();
      const target = extractPathFromArg(arg, workspaceRoot);

      if (!target) {
        vscode.window.showWarningMessage('Contexto: No file selected.');
        return;
      }

      const relPath = normalizePath(target.relativePath);

      // Add exact path to user ignore list (via centralized method to suppress re-entrant reload)
      const config = vscode.workspace.getConfiguration('contexto');
      const current = config.get<string[]>('ignore', []);
      if (!current.includes(relPath)) {
        const updated = [...current, relPath];
        await contextManager.updateUserIgnoreSettings(updated);
      }

      // Remove from explicit includes if it was previously unignored
      await contextManager.removeExplicitInclude(relPath);

      // Remove from context selection
      contextManager.removeFile(relPath);

      await contextManager.reloadIgnoreEngine();
      vscode.window.showInformationMessage(`Contexto: Ignored "${relPath}"`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Contexto: Failed to ignore — ${message}`);
    }
  };
}

/**
 * Ignores a folder and all its children in context.
 * Click the eye button on a folder → immediately adds folder/** to ignore list.
 * No QuickPick, no pattern selection — just works.
 */
export function ignoreFolderInContext(contextManager: ContextManager) {
  return async (arg?: any) => {
    try {
      const workspaceRoot = contextManager.getWorkspaceRoot();
      const target = extractPathFromArg(arg, workspaceRoot);

      if (!target) {
        vscode.window.showWarningMessage('Contexto: No folder selected.');
        return;
      }

      const relPath = normalizePath(target.relativePath);
      const pattern = `${relPath}/**`;

      // Add folder + folder/** to user ignore list (via centralized method)
      const config = vscode.workspace.getConfiguration('contexto');
      const current = config.get<string[]>('ignore', []);
      const toAdd: string[] = [];
      if (!current.includes(relPath)) {
        toAdd.push(relPath);
      }
      if (!current.includes(pattern)) {
        toAdd.push(pattern);
      }
      if (toAdd.length > 0) {
        const updated = [...current, ...toAdd];
        await contextManager.updateUserIgnoreSettings(updated);
      }

      // Remove from explicit includes
      await contextManager.removeExplicitInclude(relPath);

      // Remove folder contents from context
      contextManager.removeFilesUnderFolder(relPath);

      await contextManager.reloadIgnoreEngine();
      vscode.window.showInformationMessage(`Contexto: Ignored folder "${relPath}"`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Contexto: Failed to ignore folder — ${message}`);
    }
  };
}
