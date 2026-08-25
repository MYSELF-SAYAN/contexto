import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ContextManager } from '../core/contextManager.js';
import { IgnoreEngine } from '../core/ignoreEngine.js';
import { normalizePath, toRelativePath } from '../utils/paths.js';
import { isBinaryFile, isSensitiveFile } from '../utils/fileUtils.js';

/**
 * Tree item representing a workspace file or folder with a checkbox.
 */
export class WorkspaceTreeItem extends vscode.TreeItem {
  public isIgnored = false;

  constructor(
    public readonly absolutePath: string,
    public readonly relativePath: string,
    public readonly isDirectory: boolean,
    collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(path.basename(absolutePath) || absolutePath, collapsibleState);

    // Use resourceUri so VS Code displays the exact file/folder theme icon
    this.resourceUri = vscode.Uri.file(absolutePath);

    this.contextValue = isDirectory ? 'contextFolder' : 'contextFile';
    this.tooltip = relativePath;

    // Clicking a file opens it in the editor
    if (!isDirectory) {
      this.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [vscode.Uri.file(absolutePath)],
      };
    }
  }
}

/**
 * TreeDataProvider that renders the full workspace file tree with checkboxes.
 *
 * - Folders expand/collapse natively
 * - Checkboxes allow immediate selection / manipulation
 * - Ignored files/folders remain visible with detailed ignore source label and unignore action
 * - Checking an ignored item explicitly includes it (persisted)
 */
export class ContextTreeProvider implements vscode.TreeDataProvider<WorkspaceTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<WorkspaceTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private contextManager: ContextManager,
    private ignoreEngine: IgnoreEngine,
    private workspaceRoot: string,
  ) {
    // Refresh tree whenever context selection changes
    contextManager.onDidChange(() => {
      this._onDidChangeTreeData.fire(undefined);
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  setIgnoreEngine(engine: IgnoreEngine): void {
    this.ignoreEngine = engine;
  }

  getTreeItem(element: WorkspaceTreeItem): WorkspaceTreeItem {
    return element;
  }

  async getChildren(element?: WorkspaceTreeItem): Promise<WorkspaceTreeItem[]> {
    const dirPath = element ? element.absolutePath : this.workspaceRoot;

    let dirents: fs.Dirent[];
    try {
      dirents = await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }

    // Sort: directories first, then files, alphabetically
    dirents.sort((a, b) => {
      const aIsDir = a.isDirectory() ? 0 : 1;
      const bIsDir = b.isDirectory() ? 0 : 1;
      if (aIsDir !== bIsDir) {return aIsDir - bIsDir;}
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    const items: WorkspaceTreeItem[] = [];

    for (const dirent of dirents) {
      // Hide internal .git metadata folder only
      if (dirent.name === '.git') {
        continue;
      }

      const absPath = path.join(dirPath, dirent.name);
      const relPath = normalizePath(toRelativePath(absPath, this.workspaceRoot));
      const isDir = dirent.isDirectory();

      // Check ignore engine status
      const ignoreResult = isDir
        ? this.ignoreEngine.isDirectoryIgnored(relPath)
        : this.ignoreEngine.isIgnored(relPath);

      const collapsible = isDir
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;

      const item = new WorkspaceTreeItem(absPath, relPath, isDir, collapsible);
      item.isIgnored = ignoreResult.ignored;

      // Checkbox state
      const isSelected = this.contextManager.isPathSelected(relPath, isDir);
      item.checkboxState = isSelected
        ? vscode.TreeItemCheckboxState.Checked
        : vscode.TreeItemCheckboxState.Unchecked;

      // Descriptions and context values with detailed ignore source
      if (ignoreResult.ignored) {
        const sourceLabel = this.ignoreEngine.getIgnoreDescription(relPath);
        item.description = `ignored (${sourceLabel})`;
        item.tooltip = `${relPath}\nIgnored by: ${sourceLabel}\nClick eye button or check box to unignore`;
        item.contextValue = isDir ? 'contextIgnoredFolder' : 'contextIgnoredFile';
      } else {
        item.contextValue = isDir ? 'contextFolder' : 'contextFile';
        if (!isDir) {
          if (isBinaryFile(dirent.name)) {
            item.description = 'binary';
          } else if (isSensitiveFile(dirent.name)) {
            item.description = '⚠ sensitive';
          }
        }
      }

      items.push(item);
    }

    return items;
  }

  /**
   * Handles user toggling checkbox on files or folders in the tree view.
   * When checking an ignored item, persists the explicit include.
   */
  async handleCheckboxChange(
    items: ReadonlyArray<[WorkspaceTreeItem, vscode.TreeItemCheckboxState]>
  ): Promise<void> {
    for (const [item, state] of items) {
      const checked = state === vscode.TreeItemCheckboxState.Checked;

      if (item.isDirectory) {
        if (checked) {
          if (item.isIgnored) {
            await this.contextManager.addExplicitInclude(item.relativePath, true);
          }
          this.contextManager.addFolder(item.relativePath);
          await this.checkFolderRecursively(item.absolutePath);
        } else {
          this.contextManager.removeFolder(item.relativePath);
          this.contextManager.removeFilesUnderFolder(item.relativePath);
        }
      } else {
        if (checked) {
          if (item.isIgnored) {
            await this.contextManager.addExplicitInclude(item.relativePath, false);
          }
          this.contextManager.addFile(item.relativePath);
        } else {
          this.contextManager.removeFile(item.relativePath);
        }
      }
    }
  }

  private async checkFolderRecursively(folderAbsPath: string): Promise<void> {
    const scanner = this.contextManager.getScanner();
    const settings = await import('../models/settings.js').then(m => m.getSettings());

    const entries = await scanner.scanDirectory(
      folderAbsPath,
      this.workspaceRoot,
      this.ignoreEngine,
      { maxFileSize: settings.maxFileSize }
    );

    const flatFiles = scanner.flattenFiles(entries);
    const paths = flatFiles
      .filter(e => !e.isBinary)
      .map(e => e.relativePath);

    this.contextManager.addFileBatch(paths);
  }
}
