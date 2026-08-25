import * as assert from 'assert';
import { buildTreeString, buildPathList } from '../../core/treeBuilder.js';
import { FileEntry, FileType } from '../../models/fileEntry.js';

function makeFile(relativePath: string, opts: Partial<FileEntry> = {}): FileEntry {
  return {
    relativePath,
    absolutePath: '/workspace/' + relativePath,
    type: FileType.File,
    extension: relativePath.includes('.') ? '.' + relativePath.split('.').pop()! : '',
    language: '',
    size: opts.size ?? 100,
    included: opts.included ?? true,
    ignored: opts.ignored ?? false,
    ...opts,
  };
}

function makeDir(relativePath: string, children: FileEntry[] = []): FileEntry {
  return {
    relativePath,
    absolutePath: '/workspace/' + relativePath,
    type: FileType.Directory,
    extension: '',
    language: '',
    size: 0,
    included: true,
    ignored: false,
    children,
  };
}

suite('TreeBuilder', () => {
  test('should build tree for flat file list', () => {
    const entries: FileEntry[] = [
      makeFile('package.json'),
      makeFile('README.md'),
    ];

    const result = buildTreeString(entries);
    assert.ok(result.includes('package.json'));
    assert.ok(result.includes('README.md'));
  });

  test('should build tree with rootName header and proper indentation', () => {
    const entries: FileEntry[] = [
      makeFile('README.md'),
      makeFile('LICENSE'),
      makeDir('cli', [
        makeFile('cli/README.md'),
        makeFile('cli/package.json'),
        makeDir('cli/src', [
          makeFile('cli/src/index.ts'),
        ]),
      ]),
    ];

    const result = buildTreeString(entries, { rootName: 'myself-sayan-glidecn' });
    assert.ok(result.startsWith('└── myself-sayan-glidecn/'));
    assert.ok(result.includes('    ├── cli/'));
    assert.ok(result.includes('    │   ├── src/'));
    assert.ok(result.includes('    │   │   └── index.ts'));
    assert.ok(result.includes('    ├── LICENSE'));
    assert.ok(result.includes('    └── README.md'));
  });

  test('should build tree with nested directories', () => {
    const entries: FileEntry[] = [
      makeDir('src', [
        makeDir('src/components', [
          makeFile('src/components/Button.tsx'),
          makeFile('src/components/Navbar.tsx'),
        ]),
        makeFile('src/App.tsx'),
      ]),
      makeFile('package.json'),
    ];

    const result = buildTreeString(entries);
    assert.ok(result.includes('src/'));
    assert.ok(result.includes('Button.tsx'));
    assert.ok(result.includes('Navbar.tsx'));
    assert.ok(result.includes('App.tsx'));
    assert.ok(result.includes('package.json'));
  });

  test('should respect depth limit', () => {
    const entries: FileEntry[] = [
      makeDir('src', [
        makeDir('src/components', [
          makeFile('src/components/Button.tsx'),
        ]),
      ]),
    ];

    const result = buildTreeString(entries, { depth: 1 });
    assert.ok(result.includes('src/'));
    assert.ok(!result.includes('Button.tsx'));
  });

  test('should handle empty entries', () => {
    const result = buildTreeString([]);
    assert.strictEqual(result, '');
  });

  test('should exclude files when includeFiles is false', () => {
    const entries: FileEntry[] = [
      makeDir('src', [
        makeFile('src/index.ts'),
      ]),
      makeFile('package.json'),
    ];

    const result = buildTreeString(entries, { includeFiles: false });
    assert.ok(result.includes('src/'));
    assert.ok(!result.includes('index.ts'));
    assert.ok(!result.includes('package.json'));
  });

  test('should include file sizes when option is set', () => {
    const entries: FileEntry[] = [
      makeFile('small.ts', { size: 500 }),
    ];

    const result = buildTreeString(entries, { includeFileSizes: true });
    assert.ok(result.includes('500 B'));
  });

  test('buildPathList should return flat list of included files', () => {
    const entries: FileEntry[] = [
      makeDir('src', [
        makeFile('src/index.ts'),
        makeFile('src/ignored.ts', { included: false }),
      ]),
      makeFile('package.json'),
    ];

    const paths = buildPathList(entries);
    assert.deepStrictEqual(paths, ['src/index.ts', 'package.json']);
  });
});
