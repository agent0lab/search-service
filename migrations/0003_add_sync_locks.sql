-- Add sync_locks table to prevent concurrent syncs for the same chain
CREATE TABLE IF NOT EXISTS sync_locks (
  chain_id TEXT PRIMARY KEY,
  locked_at TEXT NOT NULL,
  worker_id TEXT NOT NULL, -- Unique identifier for the worker instance
  expires_at TEXT NOT NULL -- Lock expiration time
);

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_sync_locks_expires_at ON sync_locks(expires_at);

