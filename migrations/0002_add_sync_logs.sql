-- Add sync_logs table for tracking indexing runs
CREATE TABLE IF NOT EXISTS sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL, -- 'success', 'error', 'in_progress'
  chains TEXT NOT NULL, -- JSON array of chain IDs
  agents_indexed INTEGER DEFAULT 0,
  agents_deleted INTEGER DEFAULT 0,
  batches_processed INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER
);

-- Create index on started_at for efficient querying
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at DESC);




