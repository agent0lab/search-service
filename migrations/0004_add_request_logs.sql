-- Add request_logs table for tracking search requests
CREATE TABLE IF NOT EXISTS request_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  query TEXT NOT NULL,
  top_k INTEGER,
  filters TEXT, -- JSON string
  response_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  status_code INTEGER NOT NULL,
  error_message TEXT
);

-- Create index on timestamp for efficient querying
CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp DESC);

-- Create index on ip_address for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_request_logs_ip_address ON request_logs(ip_address);

