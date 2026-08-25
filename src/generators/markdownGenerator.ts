import { FileContent, SkippedFile } from '../models/fileEntry.js';

/**
 * Common interface for all context generators.
 * Allows adding new formats without modifying the scanner or pipeline.
 */
export interface ContextGenerator {
  generate(options: GeneratorInput): string;
}

export interface GeneratorInput {
  instructions: string;
  treeString: string;
  files: FileContent[];
  skipped: SkippedFile[];
  includeTree: boolean;
  includeFileContents: boolean;
}

/**
 * Generates Markdown-formatted context.
 *
 * Format:
 *   # Instructions
 *   ...
 *   # Project Structure
 *   ...
 *   # Files
 *   ## path/to/file.ts
 *   ```typescript
 *   ...
 *   ```
 */
export class MarkdownGenerator implements ContextGenerator {
  generate(input: GeneratorInput): string {
    const parts: string[] = [];

    // Instructions
    if (input.instructions.trim()) {
      parts.push('# Instructions\n');
      parts.push(input.instructions.trim());
      parts.push('');
    }

    // Project Structure
    if (input.includeTree && input.treeString.trim()) {
      parts.push('# Project Structure\n');
      parts.push('```');
      parts.push(input.treeString);
      parts.push('```');
      parts.push('');
    }

    // Files
    if (input.includeFileContents && input.files.length > 0) {
      parts.push('# Files\n');

      for (const file of input.files) {
        parts.push(`## ${file.relativePath}\n`);
        const lang = file.language || '';
        parts.push(`\`\`\`${lang}`);
        parts.push(file.content);
        // Ensure the closing fence is on its own line
        if (!file.content.endsWith('\n')) {
          parts.push('');
        }
        parts.push('```');
        parts.push('');
      }
    }

    // Skipped files
    if (input.skipped.length > 0) {
      parts.push('# Skipped Files\n');
      for (const skip of input.skipped) {
        parts.push(`- \`${skip.relativePath}\`: ${skip.reason}`);
      }
      parts.push('');
    }

    return parts.join('\n').trimEnd() + '\n';
  }
}
