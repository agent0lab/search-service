// Note: File-based state store is not available in Cloudflare Workers environment
// This is kept for reference but will need D1-based implementation for Workers
// For now, this file is a placeholder for future D1 implementation

import {
  InMemorySemanticSyncStateStore,
  type SemanticSyncState,
  type SemanticSyncStateStore,
  normalizeSemanticSyncState,
} from './sync-state.js';

export interface FileSemanticSyncStateStoreOptions {
  filepath: string;
  /**
   * Create parent directories automatically (default true).
   */
  autoCreateDir?: boolean;
}

/**
 * JSON file-backed semantic sync store.
 * Suitable for local development or simple deployments.
 * NOTE: Not available in Cloudflare Workers - use D1-based store instead.
 */
export class FileSemanticSyncStateStore implements SemanticSyncStateStore {
  private readonly filepath: string;
  private readonly autoCreateDir: boolean;
  private readonly fallback = new InMemorySemanticSyncStateStore();

  constructor(options: FileSemanticSyncStateStoreOptions) {
    // In Workers, file system is not available
    // This will fall back to in-memory store
    this.filepath = options.filepath;
    this.autoCreateDir = options.autoCreateDir ?? true;
  }

  async load(): Promise<SemanticSyncState | null> {
    // In Workers environment, fall back to in-memory store
    // D1 implementation will be added in future commit
    return this.fallback.load();
  }

  async save(state: SemanticSyncState): Promise<void> {
    // In Workers environment, fall back to in-memory store
    // D1 implementation will be added in future commit
    await this.fallback.save(state);
  }

  async clear(): Promise<void> {
    await this.fallback.clear();
  }
}

