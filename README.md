# CodeDigest

A lightweight, local-first VS Code extension that converts workspace files into clean, AI-ready context. Inspired by [Gitingest](https://gitingest.com/), [Repomix](https://github.com/yamadashy/repomix), and [Files2Prompt](https://github.com/simonw/files-to-prompt).

## Features

### 🗂️ Three First-Class Modes

- **Generate Context** — Full prompt with instructions, structure, and file contents
- **Copy Structure** — Directory tree only (no file reading)
- **Copy Paths** — Flat list of workspace-relative file paths

### 📁 Explorer Integration

Right-click any file or folder in the Explorer:

- **Add to Context** — Add files/folders to your context
- **Copy Context** — Generate and copy context in one step
- **Copy Structure** — Copy directory tree to clipboard
- **Copy Paths** — Copy file paths to clipboard
- **Ignore in Context** — 1-click ignore via eye-closed button

### 🌳 Activity Bar Sidebar

- View full workspace file tree with native checkboxes
- Instant 1-click Ignore (`$(eye-closed)`) & Unignore (`$(eye)`) buttons
- Live stats (files included, ignored, binary, estimated tokens)
- Quick access to generate, copy prompt, copy structure, and clear

### 📋 Copy Format Selector

- **Copy Prompt** — Copies using the current output format (default: XML)
- **Copy Prompt As...** (`$(chevron-down)`) — QuickPick dropdown to choose XML, Markdown, or Plain Text
- All copy commands respect your chosen format

### 🚫 1-Click Smart Ignore & Unignore System

Six-level precedence system that gives you complete control:

```
Direct Unignore → User Ignore → Folder Unignore (Inherited) → .contextignore → .gitignore → Default Ignores
```

- **Default ignores**: `node_modules/`, `.git/`, `dist/`, `build/`, `.next/`, etc.
- **.gitignore**: Automatically respected
- **.contextignore**: Project-level context-specific ignores
- **1-Click Ignore (`$(eye-closed)`)**:
  - File: instantly ignores the exact file
  - Folder: recursively ignores the folder and all its children (`folder/**`)
- **1-Click Unignore (`$(eye)`)**:
  - Unignores any file or folder regardless of which layer ignored it
  - Unignoring a folder automatically unignores all child files and subfolders
  - Persisted in `codeDigest.explicitIncludes` workspace settings (survives restarts)

### 📝 Three Output Formats

- **XML** (default) — CDATA sections for safe, robust LLM embedding
- **Markdown** — Fenced code blocks with language identifiers
- **Plain Text** — Simple separator-based formatting

### 🔢 Token Estimation

Real-time approximate token count displayed in:
- Sidebar tree & stats
- Status bar
- Preview panel

### 👁️ Live Preview Panel

Interactive WebView preview:
- Live updates as you check/uncheck files in the sidebar
- Format switching tabs (XML, Markdown, Text)
- Copy Prompt / Export / Refresh buttons
- Token, line, character, and file statistics

### 🔒 Safety Features

- **Binary files**: Automatically detected and skipped
- **Large files**: Configurable size limit (default: 1 MB)
- **Sensitive files**: `.env`, `*.pem`, `*.key` flagged and protected
- **100% Local**: No telemetry, no backend, no cloud sync, no API keys needed

## Installation

### From Source

```bash
git clone https://github.com/codedigest/code-digest.git
cd code-digest
npm install
npm run compile
```

Press `F5` in VS Code to launch the Extension Development Host.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `codeDigest.respectGitignore` | `true` | Respect `.gitignore` patterns |
| `codeDigest.useContextignore` | `true` | Respect `.contextignore` file |
| `codeDigest.ignore` | `[]` | Custom ignore patterns |
| `codeDigest.explicitIncludes` | `[]` | Persistent explicit includes (managed via Unignore) |
| `codeDigest.defaultFormat` | `xml` | Default output format (`xml`, `markdown`, `plaintext`) |
| `codeDigest.maxFileSize` | `1048576` | Max file size in bytes (default: 1 MB) |
| `codeDigest.includeTree` | `true` | Include directory tree in context |
| `codeDigest.includeFileContents` | `true` | Include file contents in context |
| `codeDigest.includeEmptyLines` | `true` | Preserve empty lines |
| `codeDigest.treeDepth` | `0` | Tree depth limit (0 = unlimited) |

## .contextignore

Create a `.contextignore` file in your project root:

```gitignore
# Generated
node_modules/
.next/
dist/

# Tests
**/*.test.ts
**/*.spec.ts

# Large files
*.lock
```

## Privacy

**CodeDigest is completely local.**

- ❌ No backend server
- ❌ No telemetry or tracking
- ❌ No external API calls
- ❌ No cloud sync
- ❌ No AI APIs required
- ✅ All processing happens on your machine
- ✅ Works completely offline

Your source code never leaves your computer.

## Commands

| Command | Description |
|---------|-------------|
| `CodeDigest: Open` | Open the sidebar |
| `CodeDigest: Add Active File` | Add current file to context |
| `CodeDigest: Add Open Editors` | Add all open tabs to context |
| `CodeDigest: Add Folder` | Add a folder to context |
| `CodeDigest: Select All Files` | Select all workspace files |
| `CodeDigest: Generate Prompt` | Generate context / open live preview |
| `CodeDigest: Copy Structure` | Copy directory tree |
| `CodeDigest: Copy Prompt` | Copy generated context (default format) |
| `CodeDigest: Copy Prompt As...` | Copy context with format picker |
| `CodeDigest: Copy Paths` | Copy file paths |
| `CodeDigest: Export` | Export context to file |
| `CodeDigest: Clear / Unselect All` | Clear all selections |
| `CodeDigest: Ignore in Context` | Ignore file or folder |
| `CodeDigest: Unignore in Context` | Unignore file or folder |

## Architecture

```
src/
├── extension.ts          # Entry point (command registration & event wiring)
├── commands/             # Action handlers
├── core/                 # Business logic
│   ├── scanner.ts        # Fast directory traversal
│   ├── ignoreEngine.ts   # Multi-layered ignore & explicit include engine
│   ├── selectionResolver.ts  # Dynamic selection resolution
│   ├── treeBuilder.ts    # ASCII directory tree generator
│   ├── fileReader.ts     # Safe file content reader
│   ├── contextManager.ts # Reactive context state management
│   └── tokenCounter.ts   # Token & character metrics
├── generators/           # XML, Markdown, Plain Text formatters
├── models/               # Data structures & settings
├── ui/                   # TreeView, StatusBar, PreviewPanel
└── utils/                # Pure utilities
```

## License

MIT
