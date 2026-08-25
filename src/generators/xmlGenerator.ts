import { ContextGenerator, GeneratorInput } from './markdownGenerator.js';

/**
 * Generates XML-formatted context.
 *
 * Format:
 *   <context>
 *     <instructions>...</instructions>
 *     <structure>...</structure>
 *     <files>
 *       <file path="..." language="..."><![CDATA[...]]></file>
 *     </files>
 *   </context>
 */
export class XmlGenerator implements ContextGenerator {
  generate(input: GeneratorInput): string {
    const parts: string[] = [];

    parts.push('<context>');

    // Instructions
    if (input.instructions.trim()) {
      parts.push('');
      parts.push('<instructions>');
      parts.push(escapeXml(input.instructions.trim()));
      parts.push('</instructions>');
    }

    // Project Structure
    if (input.includeTree && input.treeString.trim()) {
      parts.push('');
      parts.push('<structure>');
      parts.push(escapeXml(input.treeString));
      parts.push('</structure>');
    }

    // Files
    if (input.includeFileContents && input.files.length > 0) {
      parts.push('');
      parts.push('<files>');

      for (const file of input.files) {
        const lang = file.language ? ` language="${escapeAttr(file.language)}"` : '';
        parts.push('');
        parts.push(`<file path="${escapeAttr(file.relativePath)}"${lang}>`);
        parts.push('<![CDATA[');
        // Replace any ]]> inside content to prevent breaking CDATA
        parts.push(file.content.replace(/]]>/g, ']]]]><![CDATA[>'));
        parts.push(']]>');
        parts.push('</file>');
      }

      parts.push('');
      parts.push('</files>');
    }

    // Skipped files
    if (input.skipped.length > 0) {
      parts.push('');
      parts.push('<skipped>');
      for (const skip of input.skipped) {
        parts.push(`  <file path="${escapeAttr(skip.relativePath)}" reason="${escapeAttr(skip.reason)}" />`);
      }
      parts.push('</skipped>');
    }

    parts.push('');
    parts.push('</context>');

    return parts.join('\n') + '\n';
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
