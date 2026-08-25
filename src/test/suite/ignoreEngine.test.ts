import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IgnoreEngine, DEFAULT_IGNORE_PATTERNS } from '../../core/ignoreEngine.js';

suite('IgnoreEngine', () => {
  test('should ignore default patterns', () => {
    const engine = new IgnoreEngine();
    const result = engine.isIgnored('node_modules/package/index.js');
    assert.ok(result.ignored);
    assert.strictEqual(result.source, 'default');
  });

  test('should ignore .git directory', () => {
    const engine = new IgnoreEngine();
    const result = engine.isDirectoryIgnored('.git');
    assert.ok(result.ignored);
  });

  test('should not ignore normal source files', () => {
    const engine = new IgnoreEngine();
    const result = engine.isIgnored('src/index.ts');
    assert.ok(!result.ignored);
  });

  test('should ignore lock files by default', () => {
    const engine = new IgnoreEngine();
    const result = engine.isIgnored('package-lock.json');
    const lockResult = engine.isIgnored('yarn.lock');
    assert.ok(lockResult.ignored);
  });

  test('should respect direct explicit includes', () => {
    const engine = new IgnoreEngine();
    engine.setExplicitIncludes(['node_modules/important/file.js']);
    const result = engine.isIgnored('node_modules/important/file.js');
    assert.ok(!result.ignored);
  });

  test('should respect folder explicit includes for children', () => {
    const engine = new IgnoreEngine();
    engine.addExplicitInclude('dist');
    assert.ok(!engine.isDirectoryIgnored('dist').ignored);
    assert.ok(!engine.isIgnored('dist/bundle.js').ignored);
    assert.ok(!engine.isIgnored('dist/sub/app.js').ignored);
  });

  test('should load user ignore patterns', () => {
    const engine = new IgnoreEngine();
    engine.loadUserIgnores(['**/*.test.ts', 'docs/**']);
    
    assert.ok(engine.isIgnored('src/utils.test.ts').ignored);
    assert.ok(engine.isIgnored('docs/guide.md').ignored);
    assert.ok(!engine.isIgnored('src/utils.ts').ignored);
  });

  test('should allow user ignore to override inherited folder include', () => {
    const engine = new IgnoreEngine();
    engine.addExplicitInclude('dist');
    engine.loadUserIgnores(['dist/secret.json']);

    assert.ok(!engine.isIgnored('dist/bundle.js').ignored);
    assert.ok(engine.isIgnored('dist/secret.json').ignored);
  });

  test('should load .gitignore from workspace', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'build/\n*.log\n');
      
      const engine = new IgnoreEngine();
      await engine.loadGitignore(tmpDir);
      
      assert.ok(engine.isIgnored('build/output.js').ignored);
      assert.ok(engine.isIgnored('error.log').ignored);
      assert.ok(!engine.isIgnored('src/app.ts').ignored);
      assert.ok(engine.hasGitignore);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should load .contextignore from workspace', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, '.contextignore'), '**/*.spec.ts\nfixtures/\n');
      
      const engine = new IgnoreEngine();
      await engine.loadContextignore(tmpDir);
      
      assert.ok(engine.isIgnored('src/app.spec.ts').ignored);
      assert.ok(engine.isIgnored('fixtures/data.json').ignored);
      assert.ok(engine.hasContextignore);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should handle missing .gitignore gracefully', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-test-'));
    try {
      const engine = new IgnoreEngine();
      await engine.loadGitignore(tmpDir);
      assert.ok(!engine.hasGitignore);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should have expected default patterns', () => {
    assert.ok(DEFAULT_IGNORE_PATTERNS.includes('node_modules'));
    assert.ok(DEFAULT_IGNORE_PATTERNS.includes('.git'));
    assert.ok(DEFAULT_IGNORE_PATTERNS.includes('dist'));
    assert.ok(DEFAULT_IGNORE_PATTERNS.includes('coverage'));
  });
});
