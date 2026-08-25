import * as assert from 'assert';
import { isBinaryFile, isSensitiveFile, isLargeFile } from '../../utils/fileUtils.js';

suite('FileUtils', () => {
  suite('isBinaryFile', () => {
    test('should detect common image formats', () => {
      assert.ok(isBinaryFile('photo.png'));
      assert.ok(isBinaryFile('image.jpg'));
      assert.ok(isBinaryFile('icon.gif'));
      assert.ok(isBinaryFile('picture.webp'));
    });

    test('should detect executables', () => {
      assert.ok(isBinaryFile('app.exe'));
      assert.ok(isBinaryFile('lib.dll'));
      assert.ok(isBinaryFile('module.so'));
    });

    test('should detect archives', () => {
      assert.ok(isBinaryFile('bundle.zip'));
      assert.ok(isBinaryFile('archive.tar'));
      assert.ok(isBinaryFile('compressed.gz'));
    });

    test('should detect fonts', () => {
      assert.ok(isBinaryFile('font.woff'));
      assert.ok(isBinaryFile('font.woff2'));
      assert.ok(isBinaryFile('font.ttf'));
    });

    test('should not flag text files', () => {
      assert.ok(!isBinaryFile('code.ts'));
      assert.ok(!isBinaryFile('readme.md'));
      assert.ok(!isBinaryFile('config.json'));
      assert.ok(!isBinaryFile('style.css'));
      assert.ok(!isBinaryFile('Dockerfile'));
    });

    test('should be case insensitive via extension', () => {
      assert.ok(isBinaryFile('IMAGE.PNG'));
      assert.ok(isBinaryFile('photo.JPG'));
    });
  });

  suite('isSensitiveFile', () => {
    test('should detect .env files', () => {
      assert.ok(isSensitiveFile('.env'));
      assert.ok(isSensitiveFile('.env.local'));
      assert.ok(isSensitiveFile('.env.production'));
    });

    test('should detect key files', () => {
      assert.ok(isSensitiveFile('server.pem'));
      assert.ok(isSensitiveFile('private.key'));
    });

    test('should detect credentials files', () => {
      assert.ok(isSensitiveFile('credentials.json'));
      assert.ok(isSensitiveFile('service-account.json'));
    });

    test('should not flag normal files', () => {
      assert.ok(!isSensitiveFile('package.json'));
      assert.ok(!isSensitiveFile('index.ts'));
      assert.ok(!isSensitiveFile('README.md'));
    });
  });

  suite('isLargeFile', () => {
    test('should flag files over threshold', () => {
      assert.ok(isLargeFile(2000000, 1048576));
    });

    test('should not flag files under threshold', () => {
      assert.ok(!isLargeFile(500000, 1048576));
    });

    test('should not flag files at exactly the threshold', () => {
      assert.ok(!isLargeFile(1048576, 1048576));
    });
  });
});
