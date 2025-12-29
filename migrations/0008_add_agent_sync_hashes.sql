-- Add normalized agent hash table for semantic sync state
-- Replaces large per-chain JSON blobs stored in sync_state.agent_hashes

CREATE TABLE IF NOT EXISTS agent_sync_hashes (
  chain_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  hash TEXT NOT NULL,
  updated_at TEXT NOT NULL, -- ISO timestamp
  PRIMARY KEY (chain_id, agent_id)
);

-- Helpful for maintenance/debug queries by chain
CREATE INDEX IF NOT EXISTS idx_agent_sync_hashes_chain_id ON agent_sync_hashes(chain_id);

-- Helpful for auditing / potential GC strategies
CREATE INDEX IF NOT EXISTS idx_agent_sync_hashes_updated_at ON agent_sync_hashes(updated_at);


