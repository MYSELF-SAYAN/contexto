import * as vscode from 'vscode';
import { TokenStats } from '../core/tokenCounter.js';

/**
 * Manages the WebView preview panel.
 * Sends generated content to the WebView via postMessage.
 * Receives UI actions (copy, export, tab switch) via postMessage.
 */
export class PreviewPanel {
  private static instance: PreviewPanel | undefined;
  private panel: vscode.WebviewPanel | undefined;
  private extensionUri: vscode.Uri;

  // Callbacks for WebView actions
  public onCopy?: (format: string) => void;
  public onExport?: (format: string) => void;
  public onRefresh?: () => void;
  public onFormatChange?: (format: string) => void;

  private constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  /**
   * Gets or creates the singleton preview panel.
   */
  static getInstance(extensionUri: vscode.Uri): PreviewPanel {
    if (!PreviewPanel.instance) {
      PreviewPanel.instance = new PreviewPanel(extensionUri);
    }
    return PreviewPanel.instance;
  }

  /**
   * Returns true if the preview panel is currently open and visible.
   */
  isOpen(): boolean {
    return this.panel !== undefined;
  }

  /**
   * Shows the preview panel with generated content.
   */
  show(contents: Record<string, string>, stats: TokenStats, activeFormat: string): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside, true);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'codeDigestPreview',
        'CodeDigest Preview',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });

      this.panel.webview.onDidReceiveMessage((message) => {
        switch (message.command) {
          case 'copy':
            this.onCopy?.(message.format);
            break;
          case 'export':
            this.onExport?.(message.format);
            break;
          case 'refresh':
            this.onRefresh?.();
            break;
          case 'formatChange':
            this.onFormatChange?.(message.format);
            break;
        }
      });

      this.panel.webview.html = this.getHtml(this.panel.webview);
    }

    // Send content to WebView
    this.panel.webview.postMessage({
      command: 'setContent',
      contents,
      stats,
      activeFormat,
    });
  }

  /**
   * Updates content without stealing focus or recreating panel.
   */
  update(contents: Record<string, string>, stats: TokenStats, activeFormat: string): void {
    if (this.panel) {
      this.panel.webview.postMessage({
        command: 'setContent',
        contents,
        stats,
        activeFormat,
      });
    }
  }

  /**
   * Generates the WebView HTML.
   * Inline HTML/CSS/JS — no React, no build step.
   */
  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>CodeDigest Preview</title>
  <style nonce="${nonce}">
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: var(--vscode-editor-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }

    .tabs {
      display: flex;
      gap: 4px;
    }

    .tab {
      padding: 4px 12px;
      cursor: pointer;
      border: 1px solid transparent;
      background: none;
      color: var(--vscode-foreground);
      font-size: var(--vscode-font-size);
      font-family: var(--vscode-font-family);
      border-radius: 3px;
      opacity: 0.75;
      font-weight: 500;
    }

    .tab:hover {
      opacity: 1;
      background: var(--vscode-toolbar-hoverBackground);
    }

    .tab.active {
      opacity: 1;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border-color: var(--vscode-focusBorder);
    }

    .spacer { flex: 1; }

    .actions {
      display: flex;
      gap: 6px;
    }

    .btn {
      padding: 4px 12px;
      cursor: pointer;
      border: 1px solid var(--vscode-button-border, transparent);
      font-size: var(--vscode-font-size);
      font-family: var(--vscode-font-family);
      border-radius: 3px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .content {
      flex: 1;
      overflow: auto;
      padding: 16px;
    }

    .content pre {
      font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace);
      font-size: var(--vscode-editor-font-size, 13px);
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
      tab-size: 2;
    }

    .stats-bar {
      display: flex;
      gap: 16px;
      padding: 6px 16px;
      background: var(--vscode-statusBar-background);
      color: var(--vscode-statusBar-foreground);
      font-size: 12px;
      border-top: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .stat-label {
      opacity: 0.8;
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      opacity: 0.6;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="tabs">
      <button class="tab" data-format="xml">XML</button>
      <button class="tab" data-format="markdown">Markdown</button>
      <button class="tab" data-format="plaintext">Text</button>
    </div>
    <div class="spacer"></div>
    <div class="actions">
      <button class="btn btn-secondary" id="refreshBtn" title="Refresh">↻ Refresh</button>
      <button class="btn btn-primary" id="copyBtn" title="Copy to clipboard">⎘ Copy Prompt</button>
      <button class="btn btn-secondary" id="exportBtn" title="Export to file">↓ Export</button>
    </div>
  </div>

  <div class="content" id="content">
    <div class="empty-state">Select files in CodeDigest to see the live preview.</div>
  </div>

  <div class="stats-bar" id="statsBar">
    <div class="stat"><span class="stat-label">Files:</span> <span id="statFiles">0</span></div>
    <div class="stat"><span class="stat-label">Lines:</span> <span id="statLines">0</span></div>
    <div class="stat"><span class="stat-label">Chars:</span> <span id="statChars">0</span></div>
    <div class="stat"><span class="stat-label">Tokens:</span> <span id="statTokens">~0</span></div>
  </div>

  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      let currentFormat = 'xml';
      let contents = {};
      let stats = {};

      // Tab switching
      document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          currentFormat = tab.dataset.format;
          renderContent();
          vscode.postMessage({ command: 'formatChange', format: currentFormat });
        });
      });

      // Button handlers
      document.getElementById('copyBtn').addEventListener('click', () => {
        vscode.postMessage({ command: 'copy', format: currentFormat });
      });

      document.getElementById('exportBtn').addEventListener('click', () => {
        vscode.postMessage({ command: 'export', format: currentFormat });
      });

      document.getElementById('refreshBtn').addEventListener('click', () => {
        vscode.postMessage({ command: 'refresh' });
      });

      // Receive messages from extension
      window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'setContent') {
          contents = message.contents || {};
          stats = message.stats || {};
          if (message.activeFormat) {
            currentFormat = message.activeFormat;
            document.querySelectorAll('.tab').forEach(t => {
              t.classList.toggle('active', t.dataset.format === currentFormat);
            });
          }
          updateStats();
          renderContent();
        }
      });

      function renderContent() {
        const contentEl = document.getElementById('content');
        const text = contents[currentFormat] || '';
        if (!text) {
          contentEl.innerHTML = '<div class="empty-state">Select files in CodeDigest to see the live preview.</div>';
          return;
        }
        const pre = document.createElement('pre');
        pre.textContent = text;
        contentEl.innerHTML = '';
        contentEl.appendChild(pre);
      }

      function updateStats() {
        document.getElementById('statFiles').textContent = stats.files || 0;
        document.getElementById('statLines').textContent = (stats.lines || 0).toLocaleString();
        document.getElementById('statChars').textContent = (stats.characters || 0).toLocaleString();
        const tokens = stats.estimatedTokens || 0;
        document.getElementById('statTokens').textContent = tokens < 1000
          ? '~' + tokens
          : '~' + (tokens / 1000).toFixed(1) + 'k';
      }
    })();
  </script>
</body>
</html>`;
  }

  dispose(): void {
    this.panel?.dispose();
    PreviewPanel.instance = undefined;
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
