# Changelog

## 1.1.0

### Renamed to Contexto

- Unified extension name and branding as **Contexto** (`contexto`) across manifest, commands, settings (`contexto.*`), and UI views.

### Visual Identity & Claude-Themed Branding

- **New Lite Claude-Themed Icon**: Added clean, high-resolution 512x512 PNG icon featuring a warm ivory squircle, minimalist code document, and terracotta Claude spark.
- **Custom Activity Bar Icon**: Integrated crisp vector SVG (`media/activitybar-icon.svg`) matching the extension's visual motif and adapting seamlessly to dark, light, and high-contrast VS Code themes.
- **Preview Panel Icon**: Webview preview tab displays the extension icon in the editor tab bar.
- **Marketplace Manifest Upgrade**: Comprehensive metadata in `package.json` with AI/Programming categories, gallery banner, detailed tags, homepage, repository, and issue tracker links.
- **Upgraded Documentation**: Redesigned `README.md` with visual badges, format examples, architecture overview, and complete settings table.

### 1-Click Ignore & Unignore Overhaul

- **Instant 1-Click Ignore (`$(eye)`)**:
  - Clicking eye on a file instantly adds it to `contexto.ignore` and deselects it.
  - Clicking eye on a folder recursively ignores the folder and all its children (`folder/**`).
- **Reliable 1-Click Unignore (`$(eye-closed)`)**:
  - Unignoring a folder automatically unignores all child files and subfolders.
  - Explicit includes persist in `contexto.explicitIncludes` workspace settings to survive VS Code restarts.
  - Overrides `.gitignore`, `.contextignore`, and default rules (`node_modules`, `dist`, etc.).
- **Clear Precedence Hierarchy**:
  `Direct Unignore` > `User Ignore` > `Folder Unignore (Inherited)` > `.contextignore` > `.gitignore` > `Default Ignores`

### Copy Format Selector & XML Default

- **Default Format changed to XML**: CDATA-wrapped, optimal for LLM prompt ingestion.
- **New "Copy Prompt As..." Command (`$(chevron-down)`)**: QuickPick menu to copy in XML, Markdown, or Plain Text format.
- `Copy Context` and `Copy Folder Context` respect the user's selected format.

### Quality of Life & Developer Experience

- Non-blocking error handling with clear `Contexto:` notifications.
- Clean VSIX package builds without unnecessary files.

---

## 1.0.0

Initial release.
