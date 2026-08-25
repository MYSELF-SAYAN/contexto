import * as assert from 'assert';
import { estimateTokens, computeStats, formatTokenCount, formatStatsShort } from '../../core/tokenCounter.js';

suite('TokenCounter', () => {
  test('should estimate tokens from text length', () => {
    const text = 'a'.repeat(100);
    const tokens = estimateTokens(text);
    assert.strictEqual(tokens, 25); // 100 / 4
  });

  test('should handle empty text', () => {
    assert.strictEqual(estimateTokens(''), 0);
  });

  test('should round up', () => {
    const text = 'abc'; // 3 chars, 3/4 = 0.75 → ceil = 1
    assert.strictEqual(estimateTokens(text), 1);
  });

  test('computeStats should return correct stats', () => {
    const content = 'line1\nline2\nline3';
    const stats = computeStats(content, 3);

    assert.strictEqual(stats.files, 3);
    assert.strictEqual(stats.lines, 3);
    assert.strictEqual(stats.characters, content.length);
    assert.strictEqual(stats.estimatedTokens, Math.ceil(content.length / 4));
  });

  test('formatTokenCount should format small numbers', () => {
    assert.strictEqual(formatTokenCount(500), '~500 tokens');
  });

  test('formatTokenCount should format thousands', () => {
    assert.strictEqual(formatTokenCount(4900), '~4.9k tokens');
  });

  test('formatTokenCount should format large numbers', () => {
    assert.strictEqual(formatTokenCount(12500), '~13k tokens');
  });

  test('formatStatsShort should format status bar text', () => {
    const result = formatStatsShort(8, 4900);
    assert.strictEqual(result, '8 files · ~4.9k tokens');
  });

  test('formatStatsShort should handle singular', () => {
    const result = formatStatsShort(1, 100);
    assert.strictEqual(result, '1 file · ~100 tokens');
  });
});
