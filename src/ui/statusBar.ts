import * as vscode from 'vscode';
import { ContextManager } from '../core/contextManager.js';
import { formatStatsShort } from '../core/tokenCounter.js';

/**
 * Manages the status bar item.
 * Shows: $(file-code) CodeDigest: 8 files · ~4.9k tokens
 * Click opens the CodeDigest sidebar.
 */
export class StatusBar {
  private item: vscode.StatusBarItem;
  private contextManager: ContextManager;

  constructor(contextManager: ContextManager) {
    this.contextManager = contextManager;
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      50
    );
    this.item.command = 'codeDigest.open';
    this.item.tooltip = 'Open CodeDigest';

    // Update on context changes
    contextManager.onDidChange(() => {
      this.update();
    });

    // Initial update
    this.update();
  }

  /**
   * Updates the status bar text.
   */
  async update(): Promise<void> {
    if (this.contextManager.isEmpty()) {
      this.item.text = '$(file-code) CodeDigest: empty';
      this.item.show();
      return;
    }

    try {
      const summary = await this.contextManager.getQuickSummary();
      this.item.text = `$(file-code) CodeDigest: ${formatStatsShort(summary.included, summary.estimatedTokens)}`;
    } catch {
      const count = this.contextManager.getFileCount();
      this.item.text = `$(file-code) CodeDigest: ${count} item${count !== 1 ? 's' : ''}`;
    }

    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
