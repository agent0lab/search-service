-- Add sync_log_events table for detailed indexing event logging
CREATE TABLE IF NOT EXISTS sync_log_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_log_id INTEGER NOT NULL,
  chain_id INTEGER NOT NULL,
  event_type TEXT NOT NULL, -- 'batch-processed', 'no-op', 'error'
  timestamp TEXT NOT NULL,
  agents_indexed INTEGER DEFAULT 0,
  agents_deleted INTEGER DEFAULT 0,
  agent_ids_indexed TEXT, -- JSON array of agent IDs that were indexed
  agent_ids_deleted TEXT, -- JSON array of agent IDs that were deleted
  last_updated_at TEXT, -- Last updated timestamp from subgraph
  error_message TEXT,
  FOREIGN KEY (sync_log_id) REFERENCES sync_logs(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sync_log_events_sync_log_id ON sync_log_events(sync_log_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_events_chain_id ON sync_log_events(chain_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_events_timestamp ON sync_log_events(timestamp DESC);

