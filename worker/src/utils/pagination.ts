/**
 * Pagination utilities for offset and cursor-based pagination
 */
import type { CursorData, PaginationMetadata } from './standard-types.js';

/**
 * Encode cursor data to a cursor string.
 *
 * Cursor format (SDK-compatible):
 * - A plain decimal string representing the global offset (e.g., "0", "10", "25")
 *
 * Backward compatibility:
 * - The service previously emitted base64(JSON) cursors like btoa('{"offset":10}').
 */
export function encodeCursor(data: CursorData): string {
  return String(data.offset);
}

/**
 * Decode cursor string to cursor data.
 *
 * Accepted input formats:
 * - SDK single-chain cursor: "10"
 * - SDK multi-chain cursor: '{"_global_offset":10, ...}' (we use _global_offset)
 * - Legacy service cursor: base64('{"offset":10}')
 */
export function decodeCursor(cursor: string): CursorData | null {
  if (!cursor || typeof cursor !== 'string') {
    return null;
  }

  try {
    // 1) Fast path: plain integer string
    const trimmed = cursor.trim();
    if (/^\d+$/.test(trimmed)) {
      const offset = parseInt(trimmed, 10);
      return { offset };
    }

    // 2) JSON cursor (SDK multi-chain style)
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        if (typeof obj.offset === 'number' && Number.isFinite(obj.offset)) {
          return { offset: Math.max(0, Math.floor(obj.offset)) };
        }
        if (typeof obj._global_offset === 'number' && Number.isFinite(obj._global_offset)) {
          return { offset: Math.max(0, Math.floor(obj._global_offset)) };
        }
      }
    } catch {
      // Not JSON - continue to legacy decoding
    }

    // 3) Legacy base64(JSON) cursor
    // atob() is available in Cloudflare Workers (Web API)
    const json = atob(trimmed);
    const legacy = JSON.parse(json) as unknown;
    if (legacy && typeof legacy === 'object') {
      const obj = legacy as Record<string, unknown>;
      if (typeof obj.offset === 'number' && Number.isFinite(obj.offset)) {
        return { offset: Math.max(0, Math.floor(obj.offset)) };
      }
    }
  } catch (error) {
    return null;
  }

  return null;
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination(
  limit: number,
  offset: number,
  totalResults: number,
  currentResultsCount: number
): PaginationMetadata {
  const hasMore = offset + currentResultsCount < totalResults;
  const nextOffset = offset + currentResultsCount;

  return {
    hasMore,
    nextCursor: hasMore ? encodeCursor({ offset: nextOffset }) : undefined,
    limit,
    offset,
  };
}

/**
 * Calculate pagination metadata for cursor-based pagination
 */
export function calculateCursorPagination(
  limit: number,
  cursor: string | undefined,
  totalResults: number,
  currentResultsCount: number
): PaginationMetadata {
  const currentOffset = cursor ? decodeCursor(cursor)?.offset ?? 0 : 0;
  const nextOffset = currentOffset + currentResultsCount;
  const hasMore = nextOffset < totalResults;

  return {
    hasMore,
    nextCursor: hasMore ? encodeCursor({ offset: nextOffset }) : undefined,
    limit,
  };
}

/**
 * Get offset from cursor or offset parameter
 * Cursor takes precedence over offset
 */
export function getOffset(cursor: string | undefined, offset: number | undefined): number {
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData) {
      return cursorData.offset;
    }
  }
  return offset ?? 0;
}

/**
 * Apply pagination to results array
 */
export function paginateResults<T>(results: T[], offset: number, limit: number): T[] {
  return results.slice(offset, offset + limit);
}

