import type { D1Database } from '@cloudflare/workers-types';

/**
 * Default configuration values
 */
const DEFAULT_CHAINS = [11155111, 84532, 80002]; // Sepolia, Base Sepolia, Polygon Amoy
const DEFAULT_CRON_INTERVAL = '*/15 * * * *'; // Every 15 minutes

/**
 * Get configured chains from D1, or return defaults if not set
 */
export async function getChains(db: D1Database): Promise<number[]> {
  try {
    const result = await db
      .prepare('SELECT value FROM indexing_config WHERE key = ?')
      .bind('chains')
      .first<{ value: string }>();

    if (result && result.value) {
      const parsed = JSON.parse(result.value);
      if (Array.isArray(parsed)) {
        return parsed.map((id) => Number(id)).filter((id) => !Number.isNaN(id));
      }
    }
  } catch (error) {
    console.warn('Error reading chains config from D1, using defaults:', error);
  }

  return DEFAULT_CHAINS;
}

/**
 * Set chains configuration in D1
 */
export async function setChains(db: D1Database, chains: number[]): Promise<void> {
  try {
    const value = JSON.stringify(chains);
    await db
      .prepare(
        'INSERT INTO indexing_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
      )
      .bind('chains', value, value)
      .run();
  } catch (error) {
    console.error('Error saving chains config to D1:', error);
    throw error;
  }
}

/**
 * Get cron interval from D1, or return default if not set
 */
export async function getCronInterval(db: D1Database): Promise<string> {
  try {
    const result = await db
      .prepare('SELECT value FROM indexing_config WHERE key = ?')
      .bind('cron_interval')
      .first<{ value: string }>();

    if (result && result.value) {
      const parsed = JSON.parse(result.value);
      if (typeof parsed === 'string') {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('Error reading cron_interval config from D1, using default:', error);
  }

  return DEFAULT_CRON_INTERVAL;
}

/**
 * Set cron interval configuration in D1
 */
export async function setCronInterval(db: D1Database, interval: string): Promise<void> {
  try {
    const value = JSON.stringify(interval);
    await db
      .prepare(
        'INSERT INTO indexing_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
      )
      .bind('cron_interval', value, value)
      .run();
  } catch (error) {
    console.error('Error saving cron_interval config to D1:', error);
    throw error;
  }
}

/**
 * Initialize default configuration values in D1 if they don't exist
 */
export async function initializeDefaults(db: D1Database): Promise<void> {
  try {
    // Check if config exists
    const result = await db
      .prepare('SELECT COUNT(*) as count FROM indexing_config')
      .first<{ count: number }>();

    if (result && result.count === 0) {
      // Insert defaults
      await setChains(db, DEFAULT_CHAINS);
      await setCronInterval(db, DEFAULT_CRON_INTERVAL);
      console.log('Initialized default indexing configuration');
    }
  } catch (error) {
    console.error('Error initializing default config:', error);
    // Don't throw - allow service to continue with hardcoded defaults
  }
}

