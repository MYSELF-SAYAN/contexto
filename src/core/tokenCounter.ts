/**
 * Abstraction for token estimation.
 * Can be replaced with model-specific tokenizers later.
 */
export interface TokenEstimator {
  estimate(text: string): number;
}

/**
 * Simple character-based token estimator.
 * Uses ~4 characters per token as a rough approximation.
 * Clearly labeled as approximate.
 */
export class SimpleTokenEstimator implements TokenEstimator {
  private readonly charsPerToken = 4;

  estimate(text: string): number {
    if (!text) {return 0;}
    return Math.ceil(text.length / this.charsPerToken);
  }
}

/**
 * Token and content statistics.
 */
export interface TokenStats {
  files: number;
  lines: number;
  characters: number;
  estimatedTokens: number;
}

// Singleton estimator
const estimator = new SimpleTokenEstimator();

/**
 * Estimates token count for a text string.
 */
export function estimateTokens(text: string): number {
  return estimator.estimate(text);
}

/**
 * Computes comprehensive stats for generated content.
 */
export function computeStats(content: string, fileCount: number): TokenStats {
  const lines = content ? content.split('\n').length : 0;
  return {
    files: fileCount,
    lines,
    characters: content.length,
    estimatedTokens: estimateTokens(content),
  };
}

/**
 * Formats a token count for display.
 * Examples: "~4,900 tokens", "~12.5k tokens"
 */
export function formatTokenCount(count: number): string {
  if (count < 1000) {
    return `~${count} tokens`;
  }
  if (count < 10000) {
    return `~${(count / 1000).toFixed(1)}k tokens`;
  }
  return `~${(count / 1000).toFixed(0)}k tokens`;
}

/**
 * Formats a short stats string for the status bar.
 */
export function formatStatsShort(files: number, tokens: number): string {
  return `${files} file${files !== 1 ? 's' : ''} · ${formatTokenCount(tokens)}`;
}
