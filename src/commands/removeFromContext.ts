import * as vscode from 'vscode';
import { ContextManager } from '../core/contextManager.js';
import { extractPathFromArg } from '../utils/paths.js';

/**
 * Removes a file or folder from the context.
 * Works from both Explorer and sidebar TreeView.
 */
export function removeFromContext(contextManager: ContextManager) {
  return async (arg?: any) => {
    const workspaceRoot = contextManager.getWorkspaceRoot();
    const target = extractPathFromArg(arg, workspaceRoot);

    if (!target) {
      vscode.window.showWarningMessage('No item selected.');
      return;
    }

    contextManager.remove(target.relativePath);
    vscode.window.showInformationMessage(`Removed from context: ${target.relativePath}`);
  };
}

/**
 * Clears the entire context.
 */
export function clearContext(contextManager: ContextManager) {
  return async () => {
    if (contextManager.isEmpty()) {
      vscode.window.showInformationMessage('Context is already empty.');
      return;
    }

    contextManager.clear();
    vscode.window.showInformationMessage('Context cleared.');
  };
}
