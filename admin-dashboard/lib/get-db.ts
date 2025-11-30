// Mock database for now - will be replaced with real D1 later
import { mockDB } from './mock-db';

/**
 * Get database client (currently returns mock, will be D1 later)
 */
export function getDB() {
  return mockDB;
}

