import type { SemanticSearchFilters } from '../types.js';
import type { VectorQueryMatch, VectorQueryParams, VectorStoreProvider, VectorUpsertItem } from '../interfaces.js';
import { neon } from '@neondatabase/serverless';

export interface PgVectorStoreConfig {
  databaseUrl: string;
  table?: string;
  dimension?: number;
  batchSize?: number;
}

type Queryable = (queryText: string, params?: unknown[]) => Promise<any[]>;

export class PgVectorStore implements VectorStoreProvider {
  private readonly queryFn: Queryable;
  private readonly databaseUrl: string;
  private readonly useNodePg: boolean;
  private nodePool: {
    query: (queryText: string, params?: unknown[]) => Promise<{ rows: any[] }>;
  } | null = null;
  private readonly table: string;
  private readonly dimension: number;
  private readonly batchSize: number;
  private initialized = false;

  constructor(config: PgVectorStoreConfig) {
    if (!config?.databaseUrl) {
      throw new Error('PgVectorStore requires a databaseUrl');
    }

    this.databaseUrl = config.databaseUrl;
    this.useNodePg = this.shouldUseNodePg(this.databaseUrl);
    this.table = this.validateTableName(config.table ?? 'semantic_vectors');
    this.dimension = config.dimension ?? 1536;
    this.batchSize = config.batchSize ?? 100;

    if (this.useNodePg) {
      this.queryFn = async (q: string, p?: unknown[]) => {
        const pool = await this.getNodePgPool();
        const result = await pool.query(q, p);
        return result.rows;
      };
    } else {
      const sql = neon(config.databaseUrl) as unknown as Queryable & {
        query?: (q: string, p?: unknown[]) => Promise<any[]>;
      };

      this.queryFn = sql.query
        ? (q: string, p?: unknown[]) => sql.query!(q, p)
        : (q: string, p?: unknown[]) => sql(q, p);
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.execQuery(`CREATE EXTENSION IF NOT EXISTS vector`);
    await this.execQuery(`
      CREATE TABLE IF NOT EXISTS ${this.table} (
        id TEXT PRIMARY KEY,
        embedding vector(${this.dimension}) NOT NULL,
        metadata JSONB,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.execQuery(`CREATE INDEX IF NOT EXISTS ${this.table}_metadata_gin_idx ON ${this.table} USING GIN (metadata)`);
    try {
      await this.execQuery(
        `CREATE INDEX IF NOT EXISTS ${this.table}_embedding_hnsw_idx ON ${this.table} USING hnsw (embedding vector_cosine_ops)`
      );
    } catch {
      // hnsw index can fail on older pgvector versions; keep service functional.
    }

    this.initialized = true;
  }

  async upsert(item: VectorUpsertItem): Promise<void> {
    await this.upsertBatch([item]);
  }

  async upsertBatch(items: VectorUpsertItem[]): Promise<void> {
    if (items.length === 0) return;
    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize);
      for (const item of batch) {
        await this.execQuery(
          `
          INSERT INTO ${this.table} (id, embedding, metadata, updated_at)
          VALUES ($1, $2::vector, $3::jsonb, NOW())
          ON CONFLICT (id)
          DO UPDATE SET embedding = EXCLUDED.embedding, metadata = EXCLUDED.metadata, updated_at = NOW()
          `,
          [item.id, this.vectorLiteral(item.values), JSON.stringify(item.metadata ?? {})]
        );
      }
    }
  }

  async query(params: VectorQueryParams): Promise<VectorQueryMatch[]> {
    const topK = params.topK ?? 5;
    const fetchK = Math.min(Math.max(topK * 5, topK), 5000);

    const rows = await this.execQuery(
      `
      SELECT id, metadata, 1 - (embedding <=> $1::vector) AS score
      FROM ${this.table}
      ORDER BY embedding <=> $1::vector
      LIMIT $2
      `,
      [this.vectorLiteral(params.vector), fetchK]
    );

    const matches: VectorQueryMatch[] = [];
    for (const row of rows) {
      const metadata = this.parseMetadata(row.metadata);
      if (!this.matchesFilter(metadata, params.filter)) continue;
      matches.push({
        id: String(row.id),
        score: Number(row.score ?? 0),
        metadata,
      });
      if (matches.length >= topK) break;
    }

    return matches;
  }

  async delete(id: string): Promise<void> {
    await this.execQuery(`DELETE FROM ${this.table} WHERE id = $1`, [id]);
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.execQuery(`DELETE FROM ${this.table} WHERE id = ANY($1::text[])`, [ids]);
  }

  private async execQuery(queryText: string, params?: unknown[]): Promise<any[]> {
    return this.queryFn(queryText, params);
  }

  private shouldUseNodePg(databaseUrl: string): boolean {
    try {
      const parsed = new URL(databaseUrl);
      const host = parsed.hostname.toLowerCase();
      return host === 'localhost' || host === '127.0.0.1' || host === '::1';
    } catch {
      return false;
    }
  }

  private async getNodePgPool(): Promise<{
    query: (queryText: string, params?: unknown[]) => Promise<{ rows: any[] }>;
  }> {
    if (this.nodePool) return this.nodePool;

    const pgModule = await import('pg');
    const PoolCtor = pgModule.Pool;
    const pool = new PoolCtor({ connectionString: this.databaseUrl });
    this.nodePool = pool;
    return this.nodePool;
  }

  private validateTableName(name: string): string {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error(`Invalid PGVECTOR_TABLE name: ${name}`);
    }
    return name;
  }

  private vectorLiteral(values: number[]): string {
    return `[${values.join(',')}]`;
  }

  private parseMetadata(input: unknown): Record<string, unknown> {
    if (!input) return {};
    if (typeof input === 'object' && input !== null) return input as Record<string, unknown>;
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return {};
  }

  private matchesFilter(metadata: Record<string, unknown>, filter?: SemanticSearchFilters): boolean {
    if (!filter) return true;
    for (const [key, expected] of Object.entries(filter)) {
      const actual = metadata[key];
      if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
        const ops = expected as Record<string, unknown>;
        if ('$in' in ops && Array.isArray(ops.$in)) {
          const targets = ops.$in;
          if (Array.isArray(actual)) {
            if (!actual.some(v => targets.includes(v))) return false;
          } else if (!targets.includes(actual)) {
            return false;
          }
          continue;
        }
        if ('$nin' in ops && Array.isArray(ops.$nin)) {
          const targets = ops.$nin;
          if (Array.isArray(actual)) {
            if (actual.some(v => targets.includes(v))) return false;
          } else if (targets.includes(actual)) {
            return false;
          }
          continue;
        }
      }

      if (Array.isArray(actual) && !Array.isArray(expected)) {
        if (!actual.includes(expected)) return false;
      } else if (actual !== expected) {
        return false;
      }
    }
    return true;
  }
}
