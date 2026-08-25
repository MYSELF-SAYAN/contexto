import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Scanner } from '../../core/scanner.js';
import { IgnoreEngine } from '../../core/ignoreEngine.js';
import { FileType } from '../../models/fileEntry.js';

suite('Scanner', () => {
  let tmpDir: string;
  const scanner = new Scanner();

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-scan-'));
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('should scan flat directory', async () => {
    fs.writeFileSync(path.join(tmpDir, 'index.ts'), 'console.log("hi")');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');

    const engine = new IgnoreEngine();
    const entries = await scanner.scanDirectory(tmpDir, tmpDir, engine);

    assert.strictEqual(entries.length, 2);
    assert.ok(entries.some(e => e.relativePath.endsWith('index.ts')));
    assert.ok(entries.some(e => e.relativePath.endsWith('package.json')));
  });

  test('should scan nested directories', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.ts'), 'export {}');
    fs.writeFileSync(path.join(tmpDir, 'readme.md'), '# Hello');

    const engine = new IgnoreEngine();
    const entries = await scanner.scanDirectory(tmpDir, tmpDir, engine);

    // Should have: src/ directory and readme.md file
    assert.ok(entries.some(e => e.type === FileType.Directory));
    assert.ok(entries.some(e => e.relativePath.endsWith('readme.md')));
  });

  test('should skip ignored directories', async () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules'));
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg.js'), '');
    fs.writeFileSync(path.join(tmpDir, 'index.ts'), '');

    const engine = new IgnoreEngine();
    const entries = await scanner.scanDirectory(tmpDir, tmpDir, engine);

    const nodeModules = entries.find(e => e.relativePath.includes('node_modules'));
    assert.ok(nodeModules, 'node_modules should appear in entries');
    assert.ok(nodeModules.ignored, 'node_modules should be ignored');
    assert.ok(!nodeModules.children || nodeModules.children.length === 0, 'should not descend into node_modules');
  });

  test('should respect depth limit', async () => {
    fs.mkdirSync(path.join(tmpDir, 'a'));
    fs.mkdirSync(path.join(tmpDir, 'a', 'b'));
    fs.writeFileSync(path.join(tmpDir, 'a', 'b', 'deep.ts'), '');

    const engine = new IgnoreEngine();
    const entries = await scanner.scanDirectory(tmpDir, tmpDir, engine, { maxDepth: 1 });

    // Should find 'a' directory but not descend into it
    const dirA = entries.find(e => e.type === FileType.Directory);
    assert.ok(dirA);
    assert.strictEqual(dirA.children?.length ?? 0, 0);
  });

  test('should detect binary files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const engine = new IgnoreEngine();
    const entries = await scanner.scanDirectory(tmpDir, tmpDir, engine);

    const image = entries.find(e => e.relativePath.endsWith('image.png'));
    assert.ok(image);
    assert.ok(image.isBinary);
    assert.ok(!image.included); // Binary files should not be included
  });

  test('should detect sensitive files', async () => {
    fs.writeFileSync(path.join(tmpDir, '.env'), 'SECRET=abc');

    const engine = new IgnoreEngine();
    const entries = await scanner.scanDirectory(tmpDir, tmpDir, engine);

    const envFile = entries.find(e => e.relativePath.endsWith('.env'));
    assert.ok(envFile);
    assert.ok(envFile.isSensitive);
  });

  test('should handle empty directories', async () => {
    fs.mkdirSync(path.join(tmpDir, 'empty'));

    const engine = new IgnoreEngine();
    const entries = await scanner.scanDirectory(tmpDir, tmpDir, engine);

    const emptyDir = entries.find(e => e.type === FileType.Directory);
    assert.ok(emptyDir);
    assert.strictEqual(emptyDir.children?.length ?? 0, 0);
  });

  test('flattenFiles should collect all files', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'src', 'b.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'root.ts'), '');

    const engine = new IgnoreEngine();
    const entries = await scanner.scanDirectory(tmpDir, tmpDir, engine);
    const flat = scanner.flattenFiles(entries);

    assert.strictEqual(flat.length, 3);
    assert.ok(flat.every(e => e.type === FileType.File));
  });
});
