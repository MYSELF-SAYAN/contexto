import * as assert from 'assert';
import { MarkdownGenerator, GeneratorInput } from '../../generators/markdownGenerator.js';
import { XmlGenerator } from '../../generators/xmlGenerator.js';
import { TextGenerator } from '../../generators/textGenerator.js';
import { FileContent } from '../../models/fileEntry.js';

function makeInput(overrides: Partial<GeneratorInput> = {}): GeneratorInput {
  return {
    instructions: overrides.instructions ?? 'Analyze this project.',
    treeString: overrides.treeString ?? 'src/\n├── index.ts\n└── utils.ts',
    files: overrides.files ?? [
      {
        relativePath: 'src/index.ts',
        absolutePath: '/workspace/src/index.ts',
        language: 'typescript',
        content: 'console.log("hello");\n',
        lineCount: 1,
      },
    ],
    skipped: overrides.skipped ?? [],
    includeTree: overrides.includeTree ?? true,
    includeFileContents: overrides.includeFileContents ?? true,
  };
}

suite('Generators', () => {
  suite('MarkdownGenerator', () => {
    const gen = new MarkdownGenerator();

    test('should include instructions section', () => {
      const result = gen.generate(makeInput());
      assert.ok(result.includes('# Instructions'));
      assert.ok(result.includes('Analyze this project.'));
    });

    test('should include project structure', () => {
      const result = gen.generate(makeInput());
      assert.ok(result.includes('# Project Structure'));
      assert.ok(result.includes('├── index.ts'));
    });

    test('should include files with fenced code blocks', () => {
      const result = gen.generate(makeInput());
      assert.ok(result.includes('## src/index.ts'));
      assert.ok(result.includes('```typescript'));
      assert.ok(result.includes('console.log("hello");'));
    });

    test('should omit instructions when empty', () => {
      const result = gen.generate(makeInput({ instructions: '' }));
      assert.ok(!result.includes('# Instructions'));
    });

    test('should omit tree when includeTree is false', () => {
      const result = gen.generate(makeInput({ includeTree: false }));
      assert.ok(!result.includes('# Project Structure'));
    });

    test('should omit files when includeFileContents is false', () => {
      const result = gen.generate(makeInput({ includeFileContents: false }));
      assert.ok(!result.includes('# Files'));
    });

    test('should show skipped files', () => {
      const result = gen.generate(makeInput({
        skipped: [{ relativePath: 'big.json', reason: 'File too large' }],
      }));
      assert.ok(result.includes('# Skipped Files'));
      assert.ok(result.includes('big.json'));
    });
  });

  suite('XmlGenerator', () => {
    const gen = new XmlGenerator();

    test('should produce valid XML structure', () => {
      const result = gen.generate(makeInput());
      assert.ok(result.startsWith('<context>'));
      assert.ok(result.includes('</context>'));
    });

    test('should include instructions element', () => {
      const result = gen.generate(makeInput());
      assert.ok(result.includes('<instructions>'));
      assert.ok(result.includes('</instructions>'));
    });

    test('should include file with CDATA', () => {
      const result = gen.generate(makeInput());
      assert.ok(result.includes('<![CDATA['));
      assert.ok(result.includes(']]>'));
      assert.ok(result.includes('path="src/index.ts"'));
      assert.ok(result.includes('language="typescript"'));
    });

    test('should escape special characters in attributes', () => {
      const result = gen.generate(makeInput({
        files: [{
          relativePath: 'path/with"quotes.ts',
          absolutePath: '/workspace/path/with"quotes.ts',
          language: 'typescript',
          content: 'code',
          lineCount: 1,
        }],
      }));
      assert.ok(result.includes('&quot;'));
    });

    test('should handle CDATA terminator in content', () => {
      const result = gen.generate(makeInput({
        files: [{
          relativePath: 'test.xml',
          absolutePath: '/workspace/test.xml',
          language: 'xml',
          content: 'data ]]> more data',
          lineCount: 1,
        }],
      }));
      // Should not contain raw ]]> inside CDATA
      assert.ok(!result.includes('data ]]> more'));
    });
  });

  suite('TextGenerator', () => {
    const gen = new TextGenerator();

    test('should include separator-based sections', () => {
      const result = gen.generate(makeInput());
      assert.ok(result.includes('Instructions'));
      assert.ok(result.includes('Project Structure'));
      assert.ok(result.includes('Files'));
      assert.ok(result.includes('='.repeat(60)));
    });

    test('should include file content with path header', () => {
      const result = gen.generate(makeInput());
      assert.ok(result.includes('src/index.ts'));
      assert.ok(result.includes('console.log("hello");'));
      assert.ok(result.includes('-'.repeat(60)));
    });
  });
});
