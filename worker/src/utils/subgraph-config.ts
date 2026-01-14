import type { D1Database } from '@cloudflare/workers-types';

// Central defaults live at the search-service root.
// These are used as a fallback and to seed D1 config.
import defaultEndpoints from '../../../subgraph-endpoints.json';

export type SubgraphEndpointMap = Record<number, string>;

function normalizeMap(input: Record<string, unknown> | null | undefined): SubgraphEndpointMap {
  const out: SubgraphEndpointMap = {};
  if (!input) return out;

  for (const [k, v] of Object.entries(input)) {
    const chainId = Number(k);
    if (!Number.isFinite(chainId)) continue;
    if (typeof v !== 'string' || v.trim() === '') continue;
    out[chainId] = v;
  }
  return out;
}

export function getDefaultSubgraphEndpoints(): SubgraphEndpointMap {
  // JSON import has string keys; normalize to number keys
  return normalizeMap(defaultEndpoints as unknown as Record<string, unknown>);
}

/**
 * Optional env overrides.
 *
 * Supported:
 * - SUBGRAPH_URLS: JSON object mapping chainId -> subgraphUrl
 * - SUBGRAPH_URL_<CHAINID>: single URL override (e.g., SUBGRAPH_URL_11155111)
 */
export function getEnvSubgraphEndpoints(env: Record<string, unknown>): SubgraphEndpointMap {
  const out: SubgraphEndpointMap = {};

  const raw = env.SUBGRAPH_URLS;
  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') {
        Object.assign(out, normalizeMap(parsed as Record<string, unknown>));
      }
    } catch {
      // ignore invalid env JSON
    }
  }

  // Per-chain overrides
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('SUBGRAPH_URL_')) continue;
    const suffix = key.slice('SUBGRAPH_URL_'.length);
    const chainId = Number(suffix);
    if (!Number.isFinite(chainId)) continue;
    if (typeof value !== 'string' || value.trim() === '') continue;
    out[chainId] = value;
  }

  return out;
}

/**
 * D1 overrides stored in indexing_config under key 'subgraph_urls'.
 * Value is a JSON object mapping chainId -> subgraphUrl.
 */
export async function getD1SubgraphEndpoints(db: D1Database): Promise<SubgraphEndpointMap> {
  try {
    const row = await db
      .prepare('SELECT value FROM indexing_config WHERE key = ?')
      .bind('subgraph_urls')
      .first<{ value: string }>();

    if (!row?.value) return {};
    const parsed = JSON.parse(row.value) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return normalizeMap(parsed as Record<string, unknown>);
  } catch {
    return {};
  }
}

/**
 * Resolve full endpoint map with precedence:
 * defaults (repo) < env < D1
 */
export async function resolveSubgraphEndpoints(db: D1Database, env: Record<string, unknown>): Promise<SubgraphEndpointMap> {
  const defaults = getDefaultSubgraphEndpoints();
  const envOverrides = getEnvSubgraphEndpoints(env);
  const d1Overrides = await getD1SubgraphEndpoints(db);
  return { ...defaults, ...envOverrides, ...d1Overrides };
}

/**
 * Resolve a single chain endpoint with precedence:
 * message override (handled by caller) > D1 > env > defaults
 */
export async function resolveSubgraphUrlForChain(
  db: D1Database,
  env: Record<string, unknown>,
  chainId: number
): Promise<string | undefined> {
  const endpoints = await resolveSubgraphEndpoints(db, env);
  return endpoints[chainId];
}


