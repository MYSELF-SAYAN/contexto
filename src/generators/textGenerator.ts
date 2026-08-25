import { ContextGenerator, GeneratorInput } from './markdownGenerator.js';

/**
 * Generates plain text context with simple readable separators.
 *
 * Format:
 *   === Instructions ===
 *   ...
 *   === Project Structure ===
 *   ...
 *   === Files ===
 *   --- path/to/file.ts ---
 *   ...
 */
export class TextGenerator implements ContextGenerator {
  generate(input: GeneratorInput): string {
    const parts: string[] = [];

    // Instructions
    if (input.instructions.trim()) {
      parts.push('='.repeat(60));
      parts.push('  Instructions');
      parts.push('='.repeat(60));
      parts.push('');
      parts.push(input.instructions.trim());
      parts.push('');
    }

    // Project Structure
    if (input.includeTree && input.treeString.trim()) {
      parts.push('='.repeat(60));
      parts.push('  Project Structure');
      parts.push('='.repeat(60));
      parts.push('');
      parts.push(input.treeString);
      parts.push('');
    }

    // Files
    if (input.includeFileContents && input.files.length > 0) {
      parts.push('='.repeat(60));
      parts.push('  Files');
      parts.push('='.repeat(60));
      parts.push('');

      for (const file of input.files) {
        parts.push('-'.repeat(60));
        parts.push(`  ${file.relativePath}`);
        parts.push('-'.repeat(60));
        parts.push('');
        parts.push(file.content);
        if (!file.content.endsWith('\n')) {
          parts.push('');
        }
        parts.push('');
      }
    }

    // Skipped files
    if (input.skipped.length > 0) {
      parts.push('='.repeat(60));
      parts.push('  Skipped Files');
      parts.push('='.repeat(60));
      parts.push('');
      for (const skip of input.skipped) {
        parts.push(`  - ${skip.relativePath}: ${skip.reason}`);
      }
      parts.push('');
    }

    return parts.join('\n').trimEnd() + '\n';
  }
}
