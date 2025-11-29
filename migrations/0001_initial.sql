-- D1 Database Schema for Indexing Service
-- Stores sync state and configuration for ERC8004 registry indexing

-- Table: sync_state
-- Stores per-chain sync state for semantic indexing
CREATE TABLE IF NOT EXISTS sync_state (
  chain_id TEXT PRIMARY KEY,
  last_updated_at TEXT NOT NULL,
  agent_hashes TEXT -- JSON object stored as TEXT
);

-- Table: indexing_config
-- Stores indexing configuration (chains list, cron timing, etc.)
CREATE TABLE IF NOT EXISTS indexing_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL -- JSON value stored as TEXT
);

-- Insert default configuration values
INSERT OR IGNORE INTO indexing_config (key, value) VALUES 
  ('chains', '["11155111", "84532", "80002"]'),
  ('cron_interval', '"*/15 * * * *"');

