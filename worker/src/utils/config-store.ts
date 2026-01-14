import type { D1Database } from '@cloudflare/workers-types';
import { getDefaultSubgraphEndpoints, type SubgraphEndpointMap } from './subgraph-config.js';

/**
 * Default configuration values
 */
const DEFAULT_CHAINS = [11155111, 84532, 80002]; // Sepolia, Base Sepolia, Polygon Amoy
const DEFAULT_CRON_INTERVAL = '*/15 * * * *'; // Every 15 minutes
const DEFAULT_SUBGRAPH_URLS = getDefaultSubgraphEndpoints();

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
 * Get subgraph URL mapping from D1, or return defaults if not set
 */
export async function getSubgraphUrls(db: D1Database): Promise<SubgraphEndpointMap> {
  try {
    const result = await db
      .prepare('SELECT value FROM indexing_config WHERE key = ?')
      .bind('subgraph_urls')
      .first<{ value: string }>();

    if (result?.value) {
      const parsed = JSON.parse(result.value) as unknown;
      if (parsed && typeof parsed === 'object') {
        const out: SubgraphEndpointMap = {};
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          const chainId = Number(k);
          if (!Number.isFinite(chainId)) continue;
          if (typeof v !== 'string' || v.trim() === '') continue;
          out[chainId] = v;
        }
        return out;
      }
    }
  } catch (error) {
    console.warn('Error reading subgraph_urls config from D1, using defaults:', error);
  }

  return DEFAULT_SUBGRAPH_URLS;
}

/**
 * Set subgraph URL mapping in D1 (JSON object mapping chainId -> url)
 */
export async function setSubgraphUrls(db: D1Database, urls: SubgraphEndpointMap): Promise<void> {
  try {
    // Store as string-keyed JSON for portability
    const asStrings: Record<string, string> = {};
    for (const [chainIdStr, url] of Object.entries(urls as unknown as Record<string, string>)) {
      const chainId = Number(chainIdStr);
      if (!Number.isFinite(chainId)) continue;
      if (typeof url !== 'string' || url.trim() === '') continue;
      asStrings[String(chainId)] = url;
    }
    const value = JSON.stringify(asStrings);
    await db
      .prepare(
        'INSERT INTO indexing_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
      )
      .bind('subgraph_urls', value, value)
      .run();
  } catch (error) {
    console.error('Error saving subgraph_urls config to D1:', error);
    throw error;
  }
}

/**
 * Initialize default configuration values in D1 if they don't exist
 */
export async function initializeDefaults(db: D1Database): Promise<void> {
  try {
    // Ensure each default key exists (older deployments may have partial config)
    const ensureKey = async (key: string, jsonValue: string) => {
      await db
        .prepare('INSERT OR IGNORE INTO indexing_config (key, value) VALUES (?, ?)')
        .bind(key, jsonValue)
        .run();
    };

    await ensureKey('chains', JSON.stringify(DEFAULT_CHAINS));
    await ensureKey('cron_interval', JSON.stringify(DEFAULT_CRON_INTERVAL));
    await ensureKey('subgraph_urls', JSON.stringify(Object.fromEntries(Object.entries(DEFAULT_SUBGRAPH_URLS).map(([k, v]) => [String(k), v]))));

    console.log('Ensured default indexing configuration keys exist');
  } catch (error) {
    console.error('Error initializing default config:', error);
    // Don't throw - allow service to continue with hardcoded defaults
  }
}

