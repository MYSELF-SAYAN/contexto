/**
 * Maps file extensions to language identifiers for code fences.
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  // JavaScript / TypeScript
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.mts': 'typescript',
  '.cts': 'typescript',

  // Web
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.astro': 'astro',

  // Data / Config
  '.json': 'json',
  '.jsonc': 'jsonc',
  '.json5': 'json5',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.csv': 'csv',
  '.ini': 'ini',
  '.env': 'dotenv',

  // Python
  '.py': 'python',
  '.pyw': 'python',
  '.pyi': 'python',

  // Rust
  '.rs': 'rust',

  // Go
  '.go': 'go',

  // Java / Kotlin
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',

  // C / C++
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hh': 'cpp',

  // C#
  '.cs': 'csharp',

  // Swift
  '.swift': 'swift',

  // Ruby
  '.rb': 'ruby',
  '.erb': 'erb',

  // PHP
  '.php': 'php',

  // Shell
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'zsh',
  '.fish': 'fish',
  '.ps1': 'powershell',
  '.psm1': 'powershell',
  '.bat': 'batch',
  '.cmd': 'batch',

  // Dart / Flutter
  '.dart': 'dart',

  // SQL
  '.sql': 'sql',

  // Markdown / Docs
  '.md': 'markdown',
  '.mdx': 'mdx',
  '.rst': 'restructuredtext',
  '.tex': 'latex',

  // Lua
  '.lua': 'lua',

  // R
  '.r': 'r',
  '.R': 'r',

  // Perl
  '.pl': 'perl',
  '.pm': 'perl',

  // Haskell
  '.hs': 'haskell',
  '.lhs': 'haskell',

  // Elixir / Erlang
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.erl': 'erlang',

  // Scala
  '.scala': 'scala',

  // Clojure
  '.clj': 'clojure',
  '.cljs': 'clojure',
  '.cljc': 'clojure',

  // Docker
  '.dockerfile': 'dockerfile',

  // GraphQL
  '.graphql': 'graphql',
  '.gql': 'graphql',

  // Protocol Buffers
  '.proto': 'protobuf',

  // Terraform
  '.tf': 'hcl',
  '.hcl': 'hcl',

  // Zig
  '.zig': 'zig',

  // Nim
  '.nim': 'nim',

  // Plain text
  '.txt': 'text',
  '.log': 'log',
};

/**
 * Special filenames that map to specific languages.
 */
const FILENAME_TO_LANGUAGE: Record<string, string> = {
  'Dockerfile': 'dockerfile',
  'Makefile': 'makefile',
  'CMakeLists.txt': 'cmake',
  'Jenkinsfile': 'groovy',
  'Vagrantfile': 'ruby',
  'Gemfile': 'ruby',
  'Rakefile': 'ruby',
  '.gitignore': 'gitignore',
  '.gitattributes': 'gitattributes',
  '.editorconfig': 'editorconfig',
  '.prettierrc': 'json',
  '.eslintrc': 'json',
  '.babelrc': 'json',
};

/**
 * Detects the language identifier for a file based on its extension or name.
 * Returns empty string if unknown.
 */
export function detectLanguage(filePath: string): string {
  // Check filename first (for Dockerfile, Makefile, etc.)
  const basename = filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
  if (FILENAME_TO_LANGUAGE[basename]) {
    return FILENAME_TO_LANGUAGE[basename];
  }

  // Check extension
  const lastDot = basename.lastIndexOf('.');
  if (lastDot === -1) {
    return '';
  }
  const ext = basename.substring(lastDot).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] || '';
}
