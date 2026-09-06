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
        'contextoPreview',
        'Contexto Preview',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
        }
      );

      this.panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'icon.png');

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
  <title>Contexto Preview</title>
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

    /* Sub-tab bar for markdown view toggle */
    .sub-toolbar {
      display: none;
      align-items: center;
      gap: 4px;
      padding: 4px 16px;
      background: var(--vscode-editor-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }

    .sub-toolbar.visible {
      display: flex;
    }

    .sub-tab {
      padding: 3px 10px;
      cursor: pointer;
      border: 1px solid transparent;
      background: none;
      color: var(--vscode-foreground);
      font-size: calc(var(--vscode-font-size) - 1px);
      font-family: var(--vscode-font-family);
      border-radius: 3px;
      opacity: 0.65;
      font-weight: 500;
      transition: all 0.15s ease;
    }

    .sub-tab:hover {
      opacity: 1;
      background: var(--vscode-toolbar-hoverBackground);
    }

    .sub-tab.active {
      opacity: 1;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border-color: var(--vscode-focusBorder);
    }

    .sub-tab-label {
      opacity: 0.6;
      font-size: calc(var(--vscode-font-size) - 1px);
      margin-right: 4px;
    }

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

    /* ── XML Syntax Highlighting ── */
    .xml-tag { color: var(--vscode-symbolIcon-fieldForeground, #569cd6); }
    .xml-attr-name { color: var(--vscode-symbolIcon-propertyForeground, #9cdcfe); }
    .xml-attr-value { color: var(--vscode-symbolIcon-stringForeground, #ce9178); }
    .xml-comment { color: var(--vscode-symbolIcon-commentForeground, #6a9955); font-style: italic; }
    .xml-cdata { color: var(--vscode-symbolIcon-variableForeground, #dcdcaa); }
    .xml-pi { color: var(--vscode-symbolIcon-namespaceForeground, #c586c0); }
    .xml-text { color: var(--vscode-foreground); }
    .xml-bracket { color: var(--vscode-editorBracketHighlight-foreground1, #ffd700); }
    .xml-entity { color: var(--vscode-symbolIcon-constantForeground, #4fc1ff); }

    /* ── Markdown Rendered View ── */
    .md-rendered {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      line-height: 1.7;
      color: var(--vscode-foreground);
    }

    .md-rendered h1,
    .md-rendered h2,
    .md-rendered h3,
    .md-rendered h4,
    .md-rendered h5,
    .md-rendered h6 {
      color: var(--vscode-foreground);
      margin-top: 1.2em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.3;
    }

    .md-rendered h1 {
      font-size: 1.8em;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 0.3em;
    }

    .md-rendered h2 {
      font-size: 1.4em;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 0.25em;
    }

    .md-rendered h3 { font-size: 1.2em; }
    .md-rendered h4 { font-size: 1.05em; }

    .md-rendered p {
      margin-bottom: 0.8em;
    }

    .md-rendered code {
      font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
      font-size: 0.9em;
      background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.15));
      padding: 2px 6px;
      border-radius: 3px;
    }

    .md-rendered pre {
      background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.1));
      border: 1px solid var(--vscode-panel-border);
      border-radius: 5px;
      padding: 12px 16px;
      margin: 0.8em 0;
      overflow-x: auto;
    }

    .md-rendered pre code {
      background: none;
      padding: 0;
      font-size: var(--vscode-editor-font-size, 13px);
    }

    .md-rendered blockquote {
      border-left: 3px solid var(--vscode-textBlockQuote-border, var(--vscode-focusBorder));
      padding: 4px 16px;
      margin: 0.8em 0;
      opacity: 0.85;
      background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.05));
    }

    .md-rendered ul, .md-rendered ol {
      padding-left: 2em;
      margin-bottom: 0.8em;
    }

    .md-rendered li {
      margin-bottom: 0.3em;
    }

    .md-rendered hr {
      border: none;
      border-top: 1px solid var(--vscode-panel-border);
      margin: 1.2em 0;
    }

    .md-rendered a {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
    }

    .md-rendered a:hover {
      text-decoration: underline;
    }

    .md-rendered table {
      border-collapse: collapse;
      margin: 0.8em 0;
      width: auto;
    }

    .md-rendered th, .md-rendered td {
      border: 1px solid var(--vscode-panel-border);
      padding: 6px 12px;
      text-align: left;
    }

    .md-rendered th {
      background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.1));
      font-weight: 600;
    }

    .md-rendered img {
      max-width: 100%;
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

  <div class="sub-toolbar" id="subToolbar">
    <span class="sub-tab-label">View:</span>
    <button class="sub-tab active" data-view="rendered">Rendered</button>
    <button class="sub-tab" data-view="code">Code</button>
  </div>

  <div class="content" id="content">
    <div class="empty-state">Select files in Contexto to see the live preview.</div>
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
      let mdViewMode = 'rendered'; // 'rendered' or 'code'
      let contents = {};
      let stats = {};

      // Tab switching
      document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          currentFormat = tab.dataset.format;
          updateSubToolbar();
          renderContent();
          vscode.postMessage({ command: 'formatChange', format: currentFormat });
        });
      });

      // Sub-tab switching (markdown view toggle)
      document.querySelectorAll('.sub-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          mdViewMode = tab.dataset.view;
          renderContent();
        });
      });

      function updateSubToolbar() {
        const subToolbar = document.getElementById('subToolbar');
        if (currentFormat === 'markdown') {
          subToolbar.classList.add('visible');
        } else {
          subToolbar.classList.remove('visible');
        }
      }

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
          updateSubToolbar();
          updateStats();
          renderContent();
        }
      });

      // ── XML Syntax Highlighter ──
      function highlightXml(text) {
        // Escape HTML first
        function esc(s) {
          return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        let result = '';
        let i = 0;
        const len = text.length;

        while (i < len) {
          // Comments
          if (text.startsWith('<!--', i)) {
            const end = text.indexOf('-->', i);
            const comment = end === -1 ? text.slice(i) : text.slice(i, end + 3);
            result += '<span class="xml-comment">' + esc(comment) + '</span>';
            i += comment.length;
            continue;
          }

          // CDATA
          if (text.startsWith('<![CDATA[', i)) {
            const end = text.indexOf(']]>', i);
            const cdata = end === -1 ? text.slice(i) : text.slice(i, end + 3);
            result += '<span class="xml-cdata">' + esc(cdata) + '</span>';
            i += cdata.length;
            continue;
          }

          // Processing instructions
          if (text.startsWith('<?', i)) {
            const end = text.indexOf('?>', i);
            const pi = end === -1 ? text.slice(i) : text.slice(i, end + 2);
            result += '<span class="xml-pi">' + esc(pi) + '</span>';
            i += pi.length;
            continue;
          }

          // Tags (opening, closing, self-closing)
          if (text[i] === '<' && i + 1 < len && text[i+1] !== '!') {
            const tagEnd = text.indexOf('>', i);
            if (tagEnd === -1) {
              result += esc(text.slice(i));
              break;
            }
            const fullTag = text.slice(i, tagEnd + 1);
            result += highlightTag(fullTag);
            i = tagEnd + 1;
            continue;
          }

          // Entities like &amp; &lt; etc.
          if (text[i] === '&') {
            const semiPos = text.indexOf(';', i);
            if (semiPos !== -1 && semiPos - i < 12) {
              const entity = text.slice(i, semiPos + 1);
              result += '<span class="xml-entity">' + esc(entity) + '</span>';
              i = semiPos + 1;
              continue;
            }
          }

          // Plain text - batch consecutive non-special chars
          let textEnd = i;
          while (textEnd < len && text[textEnd] !== '<' && text[textEnd] !== '&') {
            textEnd++;
          }
          result += '<span class="xml-text">' + esc(text.slice(i, textEnd)) + '</span>';
          i = textEnd;
        }

        return result;
      }

      function highlightTag(tag) {
        function esc(s) {
          return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        let result = '';
        let j = 0;

        // Opening bracket(s): < or </
        if (tag.startsWith('</')) {
          result += '<span class="xml-bracket">&lt;/</span>';
          j = 2;
        } else {
          result += '<span class="xml-bracket">&lt;</span>';
          j = 1;
        }

        // Tag name
        let nameEnd = j;
        while (nameEnd < tag.length && !/[\\s/>]/.test(tag[nameEnd])) {
          nameEnd++;
        }
        result += '<span class="xml-tag">' + esc(tag.slice(j, nameEnd)) + '</span>';
        j = nameEnd;

        // Attributes
        while (j < tag.length) {
          // Skip whitespace
          if (/\\s/.test(tag[j])) {
            result += tag[j];
            j++;
            continue;
          }

          // Self-closing or closing bracket
          if (tag[j] === '/' && j + 1 < tag.length && tag[j+1] === '>') {
            result += '<span class="xml-bracket">/&gt;</span>';
            j += 2;
            continue;
          }

          if (tag[j] === '>') {
            result += '<span class="xml-bracket">&gt;</span>';
            j++;
            continue;
          }

          // Attribute name
          let attrEnd = j;
          while (attrEnd < tag.length && !/[\\s=/>]/.test(tag[attrEnd])) {
            attrEnd++;
          }
          if (attrEnd > j) {
            result += '<span class="xml-attr-name">' + esc(tag.slice(j, attrEnd)) + '</span>';
            j = attrEnd;
          }

          // = sign
          if (j < tag.length && tag[j] === '=') {
            result += '=';
            j++;
          }

          // Attribute value
          if (j < tag.length && (tag[j] === '"' || tag[j] === "'")) {
            const quote = tag[j];
            let valEnd = tag.indexOf(quote, j + 1);
            if (valEnd === -1) valEnd = tag.length - 1;
            const attrVal = tag.slice(j, valEnd + 1);
            result += '<span class="xml-attr-value">' + esc(attrVal) + '</span>';
            j = valEnd + 1;
          }
        }

        return result;
      }

      // ── Markdown Renderer ──
      function renderMarkdown(text) {
        function esc(s) {
          return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        const lines = text.split('\\n');
        let html = '';
        let inCodeBlock = false;
        let codeBlockContent = '';
        let codeBlockLang = '';
        let inList = false;
        let listType = '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Fenced code blocks
          if (line.trimStart().startsWith('\`\`\`')) {
            if (inCodeBlock) {
              html += '<pre><code>' + esc(codeBlockContent.replace(/\\n$/, '')) + '</code></pre>';
              inCodeBlock = false;
              codeBlockContent = '';
              codeBlockLang = '';
            } else {
              if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
              inCodeBlock = true;
              codeBlockLang = line.trim().slice(3).trim();
            }
            continue;
          }

          if (inCodeBlock) {
            codeBlockContent += line + '\\n';
            continue;
          }

          // Horizontal rule
          if (/^(---+|\\*\\*\\*+|___+)\\s*$/.test(line.trim())) {
            if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
            html += '<hr>';
            continue;
          }

          // Headings
          const headingMatch = line.match(/^(#{1,6})\\s+(.+)$/);
          if (headingMatch) {
            if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
            const level = headingMatch[1].length;
            html += '<h' + level + '>' + inlineMarkdown(headingMatch[2]) + '</h' + level + '>';
            continue;
          }

          // Blockquote
          if (line.startsWith('>')) {
            if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
            const quoteContent = line.replace(/^>\\s?/, '');
            html += '<blockquote><p>' + inlineMarkdown(quoteContent) + '</p></blockquote>';
            continue;
          }

          // Unordered list
          const ulMatch = line.match(/^(\\s*)[*+-]\\s+(.+)$/);
          if (ulMatch) {
            if (!inList || listType !== 'ul') {
              if (inList) html += listType === 'ul' ? '</ul>' : '</ol>';
              html += '<ul>';
              inList = true;
              listType = 'ul';
            }
            html += '<li>' + inlineMarkdown(ulMatch[2]) + '</li>';
            continue;
          }

          // Ordered list
          const olMatch = line.match(/^(\\s*)\\d+\\.\\s+(.+)$/);
          if (olMatch) {
            if (!inList || listType !== 'ol') {
              if (inList) html += listType === 'ul' ? '</ul>' : '</ol>';
              html += '<ol>';
              inList = true;
              listType = 'ol';
            }
            html += '<li>' + inlineMarkdown(olMatch[2]) + '</li>';
            continue;
          }

          // Close list if non-list line
          if (inList && line.trim() === '') {
            html += listType === 'ul' ? '</ul>' : '</ol>';
            inList = false;
            continue;
          }

          // Empty line
          if (line.trim() === '') {
            continue;
          }

          // Paragraph
          if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
          html += '<p>' + inlineMarkdown(line) + '</p>';
        }

        // Close any remaining open blocks
        if (inCodeBlock) {
          html += '<pre><code>' + esc(codeBlockContent.replace(/\\n$/, '')) + '</code></pre>';
        }
        if (inList) {
          html += listType === 'ul' ? '</ul>' : '</ol>';
        }

        return html;
      }

      function inlineMarkdown(text) {
        function esc(s) {
          return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
        let result = esc(text);
        // Inline code (must come first to prevent inner processing)
        result = result.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
        // Bold + Italic
        result = result.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
        // Bold
        result = result.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
        result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
        // Italic
        result = result.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
        result = result.replace(/_(.+?)_/g, '<em>$1</em>');
        // Strikethrough
        result = result.replace(/~~(.+?)~~/g, '<del>$1</del>');
        // Links
        result = result.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2">$1</a>');
        // Images
        result = result.replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, '<img src="$2" alt="$1" />');
        return result;
      }

      function renderContent() {
        const contentEl = document.getElementById('content');
        const text = contents[currentFormat] || '';
        if (!text) {
          contentEl.innerHTML = '<div class="empty-state">Select files in Contexto to see the live preview.</div>';
          return;
        }

        contentEl.innerHTML = '';

        if (currentFormat === 'xml') {
          // XML with syntax highlighting
          const pre = document.createElement('pre');
          pre.innerHTML = highlightXml(text);
          contentEl.appendChild(pre);
        } else if (currentFormat === 'markdown' && mdViewMode === 'rendered') {
          // Rendered markdown
          const div = document.createElement('div');
          div.className = 'md-rendered';
          div.innerHTML = renderMarkdown(text);
          contentEl.appendChild(div);
        } else {
          // Plain text / markdown code view
          const pre = document.createElement('pre');
          pre.textContent = text;
          contentEl.appendChild(pre);
        }
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
