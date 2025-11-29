-- Add rate_limit_tracking table for tracking requests per IP
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
  ip_address TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TEXT NOT NULL, -- ISO timestamp
  expires_at TEXT NOT NULL -- ISO timestamp for cleanup
);

-- Create index on expires_at for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_expires_at ON rate_limit_tracking(expires_at);

