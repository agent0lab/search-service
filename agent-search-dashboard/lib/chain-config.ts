import { getSubgraphEndpoints } from './subgraph-endpoints';

export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum Mainnet',
  11155111: 'Ethereum Sepolia',
  84532: 'Base Sepolia',
  80002: 'Polygon Amoy',
};

export function getChainColor(chainId: number): string {
  const colors: Record<number, string> = {
    1: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    11155111: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    84532: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    80002: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  };
  return colors[chainId] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
}

export function getAvailableChains(): { id: number; name: string }[] {
  const endpoints = getSubgraphEndpoints();
  return Object.keys(endpoints)
    .map((k) => Number(k))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b)
    .map((id) => ({
      id,
      name: CHAIN_NAMES[id] ?? `Chain ${id}`,
    }));
}
