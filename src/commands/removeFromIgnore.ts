import * as vscode from 'vscode';
import { ContextManager } from '../core/contextManager.js';
import { extractPathFromArg, normalizePath } from '../utils/paths.js';

/**
 * Unignores a file or folder in context.
 *
 * From TreeView/Explorer (clicking the eye button):
 *   - Instantly unignores without complicated prompts.
 *   - For folders: unignores the folder and all its contents recursively.
 *   - For files: unignores the specific file.
 *
 * From Command Palette (no item clicked):
 *   - Shows quick list of active ignore patterns & explicit includes to manage.
 */
export function removeFromIgnore(contextManager: ContextManager) {
  return async (arg?: any) => {
    try {
      const workspaceRoot = contextManager.getWorkspaceRoot();
      const target = extractPathFromArg(arg, workspaceRoot);

      if (target) {
        const relPath = normalizePath(target.relativePath);
        const isFolder = target.isDirectory;

        // 1. Remove from user ignore list in settings if present
        const config = vscode.workspace.getConfiguration('codeDigest');
        const current = config.get<string[]>('ignore', []);
        const folderPattern = `${relPath}/**`;

        const filtered = current.filter(p => {
          if (p === relPath || p === folderPattern) {
            return false;
          }
          if (isFolder && p.startsWith(relPath + '/')) {
            return false;
          }
          return true;
        });

        if (filtered.length !== current.length) {
          await config.update('ignore', filtered, vscode.ConfigurationTarget.Workspace);
        }

        // 2. Add to explicit includes (persisted) so it overrides .gitignore, .contextignore, and default ignores
        await contextManager.addExplicitInclude(relPath, isFolder);
        await contextManager.reloadIgnoreEngine();

        if (isFolder) {
          vscode.window.showInformationMessage(`CodeDigest: Unignored folder "${relPath}" and its contents`);
        } else {
          vscode.window.showInformationMessage(`CodeDigest: Unignored "${relPath}"`);
        }
        return;
      }

      // ── Command Palette flow — no specific item clicked ──
      const config = vscode.workspace.getConfiguration('codeDigest');
      const userPatterns = config.get<string[]>('ignore', []);
      const explicitIncludes = config.get<string[]>('explicitIncludes', []);

      const items: vscode.QuickPickItem[] = [];

      if (userPatterns.length > 0) {
        items.push({
          label: 'User Ignore Patterns',
          kind: vscode.QuickPickItemKind.Separator,
        });
        for (const pattern of userPatterns) {
          items.push({
            label: pattern,
            description: 'ignored pattern — select to remove/unignore',
            picked: false,
          });
        }
      }

      if (explicitIncludes.length > 0) {
        items.push({
          label: 'Explicit Includes (Unignored Rules)',
          kind: vscode.QuickPickItemKind.Separator,
        });
        for (const inc of explicitIncludes) {
          items.push({
            label: `↩ ${inc}`,
            description: 'explicitly unignored — select to re-ignore',
            picked: false,
          });
        }
      }

      if (items.length === 0) {
        vscode.window.showInformationMessage('CodeDigest: No custom ignore patterns or unignore rules found.');
        return;
      }

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select patterns to remove from ignore list or unignore rules to revoke',
        canPickMany: true,
        title: 'CodeDigest: Manage Ignore Rules',
      });

      if (!selected || selected.length === 0) {
        return;
      }

      const patternsToRemove: string[] = [];
      const includesToRevoke: string[] = [];

      for (const item of selected) {
        if (item.label.startsWith('↩ ')) {
          includesToRevoke.push(item.label.substring(2));
        } else {
          patternsToRemove.push(item.label);
        }
      }

      if (patternsToRemove.length > 0) {
        const updated = userPatterns.filter(p => !patternsToRemove.includes(p));
        await config.update('ignore', updated, vscode.ConfigurationTarget.Workspace);
      }

      for (const inc of includesToRevoke) {
        await contextManager.removeExplicitInclude(inc);
      }

      await contextManager.reloadIgnoreEngine();
      vscode.window.showInformationMessage(`CodeDigest: Updated ignore rules.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`CodeDigest: Failed to unignore — ${message}`);
    }
  };
}
