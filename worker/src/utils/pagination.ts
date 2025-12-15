/**
 * Pagination utilities for offset and cursor-based pagination
 */
import type { CursorData, PaginationMetadata } from './standard-types.js';

/**
 * Encode cursor data to base64 string
 * Uses btoa() which is available in Cloudflare Workers
 */
export function encodeCursor(data: CursorData): string {
  const json = JSON.stringify(data);
  // btoa() is available in Cloudflare Workers (Web API)
  return btoa(json);
}

/**
 * Decode cursor string to cursor data
 * Uses atob() which is available in Cloudflare Workers
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    // atob() is available in Cloudflare Workers (Web API)
    const json = atob(cursor);
    const data = JSON.parse(json) as CursorData;
    return data;
  } catch (error) {
    return null;
  }
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

