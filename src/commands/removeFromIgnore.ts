import * as vscode from 'vscode';
import { ContextManager } from '../core/contextManager.js';
import { extractPathFromArg, normalizePath } from '../utils/paths.js';

/**
 * Unignores a specific file or folder path by:
 *  1. Removing ALL matching user ignore rules (exact path, folder/**, and child patterns)
 *  2. Adding explicit include rules (overrides .gitignore / .contextignore / defaults)
 *  3. Reloading the ignore engine
 *
 * This is designed to be robust: it removes every pattern in the user ignore list
 * that could possibly be causing this path to be ignored, not just exact matches.
 */
export async function unignorePath(
  contextManager: ContextManager,
  relPath: string,
  isFolder: boolean
): Promise<void> {
  const normalized = normalizePath(relPath);

  // 1. Remove from user ignore list in settings — be aggressive about what we remove
  const config = vscode.workspace.getConfiguration('contexto');
  const current = config.get<string[]>('ignore', []);
  const folderPattern = `${normalized}/**`;

  const filtered = current.filter(p => {
    const pt = p.trim();

    // Remove exact path match
    if (pt === normalized) {
      return false;
    }

    // Remove folder/** pattern
    if (pt === folderPattern) {
      return false;
    }

    // If we're unignoring a folder, also remove any child patterns
    if (isFolder && pt.startsWith(normalized + '/')) {
      return false;
    }

    // Remove any parent folder pattern that covers this path
    // e.g. if "src/**" is in the list and we're unignoring "src/foo.ts"
    // we DON'T remove the parent pattern — instead we use explicit include
    // (removing a broad pattern would unignore too much)

    return true;
  });

  if (filtered.length !== current.length) {
    await contextManager.updateUserIgnoreSettings(filtered);
  }

  // 2. Add to explicit includes (persisted) so it overrides .gitignore, .contextignore, and default ignores
  await contextManager.addExplicitInclude(normalized, isFolder);
  await contextManager.reloadIgnoreEngine();
}

/**
 * Unignores a file or folder in context.
 *
 * From TreeView/Explorer (clicking the eye-closed button):
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

        await unignorePath(contextManager, relPath, isFolder);

        if (isFolder) {
          vscode.window.showInformationMessage(`Contexto: Unignored folder "${relPath}" and its contents`);
        } else {
          vscode.window.showInformationMessage(`Contexto: Unignored "${relPath}"`);
        }
        return;
      }

      // ── Command Palette flow — no specific item clicked ──
      const config = vscode.workspace.getConfiguration('contexto');
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
        vscode.window.showInformationMessage('Contexto: No custom ignore patterns or unignore rules found.');
        return;
      }

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select patterns to remove from ignore list or unignore rules to revoke',
        canPickMany: true,
        title: 'Contexto: Manage Ignore Rules',
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
        await contextManager.updateUserIgnoreSettings(updated);
      }

      for (const inc of includesToRevoke) {
        await contextManager.removeExplicitInclude(inc);
      }

      await contextManager.reloadIgnoreEngine();
      vscode.window.showInformationMessage(`Contexto: Updated ignore rules.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Contexto: Failed to unignore — ${message}`);
    }
  };
}
