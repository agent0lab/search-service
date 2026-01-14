import endpointsJson from '../../subgraph-endpoints.json';

export type SubgraphEndpointMap = Record<number, string>;

export function getSubgraphEndpoints(): SubgraphEndpointMap {
  const out: SubgraphEndpointMap = {};
  for (const [k, v] of Object.entries(endpointsJson as unknown as Record<string, unknown>)) {
    const chainId = Number(k);
    if (!Number.isFinite(chainId)) continue;
    if (typeof v !== 'string' || v.trim() === '') continue;
    out[chainId] = v;
  }
  return out;
}

export function getSubgraphUrl(chainId: number): string | undefined {
  return getSubgraphEndpoints()[chainId];
}


