import { isLikelyConnectivityIssue } from '../common/global-error-toast.js';

const HTTP_STATUS_PREFIX = /^HTTP\s+\d{3}\b/i;

const INFRA_MESSAGE_PATTERNS = [
  /response body is null/i,
  /streaming not supported/i,
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /socket hang up/i,
  /net::ERR_/i,
  /502\s+bad gateway/i,
  /503\s+service unavailable/i,
  /504\s+gateway timeout/i,
] as const;

const TECHNICAL_DUMP_PATTERNS = [
  /Traceback\s*\(/i,
  /\bSyntaxError\b/,
  /\bReferenceError\b/,
  /\bTypeError\s*:/,
  /\bat\s+[\w./()[\]<>-]+:\d+:\d+/,
  /\n\s+at\s+\w/,
  /undefined is not/i,
  /is not a function/i,
  /<anonymous>/i,
  /ChunkLoadError/i,
  /UnhandledPromiseRejection/i,
] as const;

/** Above this length, treat as dump / transport payload — show red strip instead of a chat bubble. */
const MAX_CHAT_BUBBLE_ERROR_LENGTH = 720;

/**
 * Use the red inline error strip (+ recovery pills) instead of a normal assistant bubble when the
 * failure looks like transport, HTTP, or an obvious technical dump. User-facing backend messages
 * (e.g. output_text with is_error) stay in the conversation as a chat message.
 */
export function shouldShowStreamErrorAsRedStrip(err: Error, displayText: string): boolean {
  if (isLikelyConnectivityIssue(err)) return true;

  const raw = err.message.trim();
  if (HTTP_STATUS_PREFIX.test(raw)) return true;
  if (INFRA_MESSAGE_PATTERNS.some((p) => p.test(raw))) return true;

  const text = displayText.trim();
  if (text.length > MAX_CHAT_BUBBLE_ERROR_LENGTH) return true;

  const lines = text.split(/\n/).length;
  if (lines >= 6) return true;
  if (TECHNICAL_DUMP_PATTERNS.some((p) => p.test(text))) return true;
  if (lines >= 3 && /\bat\s+/.test(text)) return true;

  return false;
}
