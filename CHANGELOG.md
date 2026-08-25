# Changelog

## 1.1.0

### Rebranded to CodeDigest

- Renamed extension to **CodeDigest** (`code-digest`) with clean namespaces across all commands, settings, and UI components.

### 1-Click Ignore & Unignore Overhaul

- **Instant 1-Click Ignore (`$(eye-closed)`)**:
  - Clicking eye-closed on a file instantly adds it to `codeDigest.ignore` and deselects it.
  - Clicking eye-closed on a folder recursively ignores the folder and all its children (`folder/**`).
- **Reliable 1-Click Unignore (`$(eye)`)**:
  - Unignoring a folder automatically unignores all child files and subfolders.
  - Explicit includes persist in `codeDigest.explicitIncludes` workspace settings to survive VS Code restarts.
  - Overrides `.gitignore`, `.contextignore`, and default rules (`node_modules`, `dist`, etc.).
- **Clear Precedence Hierarchy**:
  `Direct Unignore` > `User Ignore` > `Folder Unignore (Inherited)` > `.contextignore` > `.gitignore` > `Default Ignores`

### Copy Format Selector & XML Default

- **Default Format changed to XML**: CDATA-wrapped, optimal for LLM prompt ingestion.
- **New "Copy Prompt As..." Command (`$(chevron-down)`)**: QuickPick menu to copy in XML, Markdown, or Plain Text format.
- `Copy Context` and `Copy Folder Context` now respect the user's selected format.

### Quality of Life & Developer Experience

- Non-blocking error handling with clear `CodeDigest:` notifications.
- Clean VSIX package builds without unnecessary files.

---

## 1.0.0

Initial release.
