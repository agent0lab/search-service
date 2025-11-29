import type { D1Database } from '@cloudflare/workers-types';

/**
 * Sync lock manager to prevent concurrent syncs for the same chain
 * Uses D1 database with expiration-based locking
 */
export class SyncLockManager {
  private readonly db: D1Database;
  private readonly lockTimeoutMs: number;
  private readonly workerId: string;

  constructor(db: D1Database, lockTimeoutMs: number = 30 * 60 * 1000) {
    // 30 minutes default timeout
    this.db = db;
    this.lockTimeoutMs = lockTimeoutMs;
    // Generate a unique worker ID for this instance
    this.workerId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Try to acquire a lock for a chain. Returns true if lock was acquired, false otherwise.
   */
  async tryAcquireLock(chainId: string): Promise<boolean> {
    const now = Date.now();
    const expiresAt = now + this.lockTimeoutMs;

    try {
      // First, clean up expired locks
      await this.cleanupExpiredLocks();

      // Try to insert a new lock
      // This will fail if a lock already exists for this chain
      const result = await this.db
        .prepare(
          `INSERT INTO sync_locks (chain_id, locked_at, worker_id, expires_at)
           VALUES (?, ?, ?, ?)`
        )
        .bind(
          chainId,
          new Date(now).toISOString(),
          this.workerId,
          new Date(expiresAt).toISOString()
        )
        .run();

      return result.success;
    } catch (error) {
      // Lock already exists or other error
      console.log(`[sync-lock] Could not acquire lock for chain ${chainId}:`, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Release a lock for a chain. Should be called when sync completes.
   */
  async releaseLock(chainId: string): Promise<void> {
    try {
      await this.db
        .prepare(
          `DELETE FROM sync_locks 
           WHERE chain_id = ? AND worker_id = ?`
        )
        .bind(chainId, this.workerId)
        .run();
    } catch (error) {
      console.error(`[sync-lock] Error releasing lock for chain ${chainId}:`, error);
      // Don't throw - lock will expire naturally
    }
  }

  /**
   * Check if a lock exists for a chain (not expired)
   */
  async isLocked(chainId: string): Promise<boolean> {
    const now = new Date().toISOString();
    
    try {
      const result = await this.db
        .prepare(
          `SELECT chain_id FROM sync_locks 
           WHERE chain_id = ? AND expires_at > ?`
        )
        .bind(chainId, now)
        .first<{ chain_id: string }>();

      return result !== null;
    } catch (error) {
      console.error(`[sync-lock] Error checking lock for chain ${chainId}:`, error);
      // If we can't check, assume it's locked to be safe
      return true;
    }
  }

  /**
   * Clean up expired locks
   */
  private async cleanupExpiredLocks(): Promise<void> {
    const now = new Date().toISOString();
    
    try {
      await this.db
        .prepare(`DELETE FROM sync_locks WHERE expires_at <= ?`)
        .bind(now)
        .run();
    } catch (error) {
      console.error('[sync-lock] Error cleaning up expired locks:', error);
      // Don't throw - this is cleanup, not critical
    }
  }

  /**
   * Release all locks held by this worker (cleanup on shutdown)
   */
  async releaseAllLocks(): Promise<void> {
    try {
      await this.db
        .prepare(`DELETE FROM sync_locks WHERE worker_id = ?`)
        .bind(this.workerId)
        .run();
    } catch (error) {
      console.error('[sync-lock] Error releasing all locks:', error);
    }
  }
}

