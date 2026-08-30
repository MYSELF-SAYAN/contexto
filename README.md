<div align="center">
  <img src="media/icon.png" width="128" height="128" alt="Contexto Logo" />
  <h1>Contexto</h1>
  <p><strong>Turn your workspace files and folder structure into clean, AI-ready prompts in 1 click.</strong></p>
  <p>Local-first, ultra-fast VS Code extension optimized for <strong>Anthropic Claude</strong>, <strong>ChatGPT</strong>, <strong>Gemini</strong>, <strong>DeepSeek</strong>, and <strong>Cursor</strong>.</p>

  <p>
    <a href="https://github.com/MYSELF-SAYAN/contexto/stargazers"><img src="https://img.shields.io/github/stars/MYSELF-SAYAN/contexto?style=flat-square&color=D97757&logo=github" alt="GitHub Stars" /></a>
    <a href="https://github.com/MYSELF-SAYAN/contexto/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License: MIT" /></a>
    <img src="https://img.shields.io/badge/Privacy-100%25%20Local-success?style=flat-square&color=2e7d32" alt="100% Local" />
    <img src="https://img.shields.io/badge/Telemetry-Zero-black?style=flat-square" alt="Zero Telemetry" />
    <img src="https://img.shields.io/badge/Output-XML%20%7C%20Markdown%20%7C%20Text-orange?style=flat-square&color=D97757" alt="Output Formats" />
  </p>
</div>

---

## 💡 What is Contexto?

When you ask AI (like Claude or ChatGPT) to debug code, refactor components, or explain a repository, the AI needs two things:
1. **Your directory structure** (to understand project architecture)
2. **Your source files** (cleanly formatted with exact file paths)

Doing this manually is frustrating — you copy/paste file by file, format paths by hand, accidentally include huge build directories like `node_modules`, and quickly blow past your AI token limits.

**Contexto solves this in 1 click.** Select your files with native checkboxes in VS Code, and Contexto instantly packages your entire codebase into a clean, token-counted prompt ready to paste.

| ❌ Without Contexto | ✅ With Contexto |
|:---|:---|
| Manually copy-pasting 10+ tabs into chat | **1-Click**: Select files and hit Copy |
| Cluttered formats that confuse the AI | **Clean Delimiters**: XML CDATA or Markdown |
| Accidental `node_modules` or `.lock` token waste | **Smart Ignore**: Auto-filters build artifacts |
| Guessing how many tokens you are using | **Live Token Counter**: Real-time token estimation |
| Risk of leaking `.env` or secret keys | **Safety Shields**: Auto-skips binary & secrets |

---

## ✨ Core Features

### 🗂️ 1. Three First-Class Modes
* **Generate Full Context**: Complete AI prompt with optional instructions, directory tree, and formatted file contents.
* **Copy Directory Structure**: Instant visual tree of your workspace or folder (zero file reading, ultra-fast).
* **Copy File Paths**: Flat list of relative file paths for quick referencing.

### 📝 2. Three Output Formats (Optimized for LLMs)
Choose the output style that matches your AI workflow:
* **XML (`<![CDATA[...]]>`) — Default & Recommended**: Uses `<file path="...">` tags with CDATA escaping. This is the **gold standard for Anthropic Claude** and OpenAI models because it prevents code syntax from breaking markdown parsers.
* **Markdown**: Standard fenced code blocks with automatic syntax highlighting for over 40+ programming languages.
* **Plain Text**: Minimalist delimiter headers for simple, raw text pasting.

### 🚫 3. 1-Click Smart Ignore & Unignore
Never worry about `node_modules`, `.git`, or build caches polluting your prompt:
* **1-Click Ignore (`$(eye)`)**: Click on any file or folder in the sidebar or Explorer to instantly exclude it (folders recursively ignore children with `folder/**`).
* **1-Click Unignore (`$(eye-closed)`)**: Bring back any ignored file or folder with 1 click. Unignoring a folder automatically restores all its children.
* **Smart Precedence**: Contexto evaluates rules seamlessly:
  $$\text{Explicit Unignore} \longrightarrow \text{User Ignore} \longrightarrow \text{Inherited Folder} \longrightarrow \text{.contextignore} \longrightarrow \text{.gitignore} \longrightarrow \text{Default Ignores}$$
* **Persistent**: Your choices are saved to `.vscode/settings.json` so they survive VS Code restarts.

### 👁️ 4. Interactive Live Preview Panel
* **Live Stats**: View estimated tokens, character count, total lines, and file count in real time.
* **Format Switcher**: Toggle between XML, Markdown, and Plain Text tabs instantly.
* **Export Options**: 1-click **Copy to Clipboard** or **Export to File** (`.xml`, `.md`, `.txt`).
* **Live Sync**: Updates automatically as you check/uncheck files in the sidebar tree.

### 🔒 5. 100% Local & Privacy-First
* **Zero Telemetry / No Cloud**: Runs 100% locally on your machine. No code is ever uploaded to any server.
* **Sensitive File Shield**: Automatically detects and excludes `.env`, `*.pem`, `*.key`, and credentials.
* **Binary Detection**: Automatically skips images, videos, audio, zip archives, and compiled binaries.
* **Max File Size Guard**: Configurable file size threshold (default: 1 MB) to prevent accidental memory lag.

---

## 🚀 How to Use Contexto

### Method 1: The Activity Bar Sidebar (Recommended)

1. Click the **Contexto** icon on the VS Code Activity Bar (`media/activitybar-icon.svg`).
2. Use the **checkboxes** in the tree view to select the files and folders you want in your context.
3. Use the header action buttons:
   - **`$(play)` Generate Prompt / Live Preview** — Opens the interactive Live Preview tab.
   - **`$(copy)` Copy Prompt** — Copies the full prompt in your default format (XML).
   - **`$(chevron-down)` Copy Prompt As...** — Pick XML, Markdown, or Plain Text on the fly.
   - **`$(list-tree)` Copy Structure** — Copies only the directory tree.
   - **`$(check-all)` Select All** / **`$(clear-all)` Unselect All** — Bulk selection controls.
4. Paste directly into your AI chat window!

---

### Method 2: File Explorer Context Menu

Right-click any file or folder in the VS Code Explorer:
* **Add to Context** — Add target to your current context selection.
* **Copy Context** — Instantly generate and copy context for that specific file or folder.
* **Copy Structure** — Copy just the directory tree of the folder.
* **Copy Paths** — Copy relative file path(s) to clipboard.
* **Ignore in Context (`$(eye)`)** / **Unignore (`$(eye-closed)`)** — 1-click ignore toggle.

---

### Method 3: Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)

Open the VS Code Command Palette and type `Contexto:`
* `Contexto: Open`
* `Contexto: Generate Prompt / Live Preview`
* `Contexto: Copy Prompt`
* `Contexto: Copy Prompt As...`
* `Contexto: Copy Structure`
* `Contexto: Copy Paths`
* `Contexto: Select All Files`
* `Contexto: Clear / Unselect All`
* `Contexto: Export Context to File`

---

## 📋 Generated Prompt Example

Here is an example of what Contexto generates in **XML mode**:

```xml
This is the repository context for workspace: my-app

Directory Structure:
├── src/
│   ├── auth/
│   │   └── login.ts
│   └── index.ts
└── package.json

<file path="src/auth/login.ts">
<![CDATA[
export async function authenticate(user: string, pass: string) {
  // Authentication logic
  return { success: true };
}
]]>
</file>

<file path="src/index.ts">
<![CDATA[
import { authenticate } from './auth/login';
console.log('App started');
]]>
</file>
```

---

## ⚙️ Configuration Reference

Customize Contexto settings anytime via `Settings` (`Ctrl+,` or `Cmd+,` → search `Contexto`):

| Setting | Default | Description |
|:---|:---|:---|
| `contexto.defaultFormat` | `"xml"` | Default output format (`xml`, `markdown`, `plaintext`). |
| `contexto.respectGitignore` | `true` | Automatically respect `.gitignore` rules. |
| `contexto.useContextignore` | `true` | Respect `.contextignore` file for project-specific rules. |
| `contexto.ignore` | `[]` | Custom glob patterns to ignore across all contexts. |
| `contexto.explicitIncludes` | `[]` | Paths explicitly included via 1-click Unignore (overrides all ignores). |
| `contexto.maxFileSize` | `1048576` | Maximum file size in bytes to include (default: 1 MB). |
| `contexto.includeTree` | `true` | Include the directory tree in the generated prompt. |
| `contexto.includeFileContents` | `true` | Include file contents in the generated prompt. |
| `contexto.includeEmptyLines` | `true` | Preserve empty lines in source code. |
| `contexto.treeDepth` | `0` | Maximum tree structure depth (`0` = unlimited). |

---

## 🌟 Contributing & Feedback

* **GitHub Repository**: [MYSELF-SAYAN/contexto](https://github.com/MYSELF-SAYAN/contexto)
* **Report an Issue**: [github.com/MYSELF-SAYAN/contexto/issues](https://github.com/MYSELF-SAYAN/contexto/issues)
* **Star on GitHub**: If Contexto saves you time, please give the repo a ⭐ on [GitHub](https://github.com/MYSELF-SAYAN/contexto)!

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
