/**
 * Pagination utilities for offset and cursor-based pagination
 */
import type { CursorData, PaginationMetadata } from './standard-types.js';

/**
 * Encode cursor data to base64 string
 */
export function encodeCursor(data: CursorData): string {
  const json = JSON.stringify(data);
  return Buffer.from(json).toString('base64');
}

/**
 * Decode cursor string to cursor data
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf-8');
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

