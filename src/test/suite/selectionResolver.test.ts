import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SelectionResolver } from '../../core/selectionResolver.js';
import { IgnoreEngine } from '../../core/ignoreEngine.js';
import { createEmptySelection } from '../../models/context.js';

suite('SelectionResolver', () => {
  let tmpDir: string;
  const resolver = new SelectionResolver();

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-resolve-'));
    // Create test structure
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.ts'), 'export const app = true;');
    fs.writeFileSync(path.join(tmpDir, 'src', 'utils.ts'), 'export const utils = true;');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test');
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('should resolve folder selection', async () => {
    const selection = createEmptySelection();
    selection.folders.push('src');

    const engine = new IgnoreEngine();
    const { entries, summary } = await resolver.resolve(selection, engine, tmpDir);

    assert.ok(entries.length >= 2); // app.ts and utils.ts
    assert.ok(summary.included >= 2);
  });

  test('should resolve file selection', async () => {
    const selection = createEmptySelection();
    selection.files.push('package.json');

    const engine = new IgnoreEngine();
    const { entries } = await resolver.resolve(selection, engine, tmpDir);

    assert.strictEqual(entries.length, 1);
    assert.ok(entries[0].relativePath.includes('package.json'));
  });

  test('should deduplicate files from overlapping selections', async () => {
    const selection = createEmptySelection();
    selection.folders.push('src');
    selection.files.push('src/app.ts'); // Already covered by folder

    const engine = new IgnoreEngine();
    const { entries } = await resolver.resolve(selection, engine, tmpDir);

    // Should not have duplicates
    const paths = entries.map(e => e.relativePath);
    const unique = new Set(paths);
    assert.strictEqual(paths.length, unique.size);
  });

  test('should skip deleted files', async () => {
    const selection = createEmptySelection();
    selection.files.push('src/app.ts');
    selection.files.push('deleted-file.ts'); // Does not exist

    const engine = new IgnoreEngine();
    const { entries } = await resolver.resolve(selection, engine, tmpDir);

    assert.strictEqual(entries.length, 1);
    assert.ok(entries[0].relativePath.includes('app.ts'));
  });

  test('should skip deleted folders', async () => {
    const selection = createEmptySelection();
    selection.folders.push('nonexistent-folder');

    const engine = new IgnoreEngine();
    const { entries } = await resolver.resolve(selection, engine, tmpDir);

    assert.strictEqual(entries.length, 0);
  });

  test('should respect ignore engine', async () => {
    const selection = createEmptySelection();
    selection.folders.push('.');

    const engine = new IgnoreEngine();
    engine.loadUserIgnores(['**/*.md']);

    const { entries } = await resolver.resolve(selection, engine, tmpDir);

    const mdFiles = entries.filter(e => e.relativePath.endsWith('.md') && e.included);
    assert.strictEqual(mdFiles.length, 0);
  });

  test('should compute summary correctly', async () => {
    const selection = createEmptySelection();
    selection.folders.push('.');

    const engine = new IgnoreEngine();
    const { summary } = await resolver.resolve(selection, engine, tmpDir);

    assert.ok(summary.total > 0);
    assert.ok(summary.included > 0);
  });
});
