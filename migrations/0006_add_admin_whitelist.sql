-- Add admin_whitelist table for SIWE authentication
CREATE TABLE IF NOT EXISTS admin_whitelist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_address TEXT UNIQUE NOT NULL, -- Lowercase Ethereum address
  added_at TEXT NOT NULL, -- ISO timestamp
  added_by TEXT NOT NULL -- Address of admin who added it
);

-- Create index on wallet_address for fast lookups
CREATE INDEX IF NOT EXISTS idx_admin_whitelist_wallet_address ON admin_whitelist(wallet_address);

