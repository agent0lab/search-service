import { describe, it, expect } from 'vitest';
import { computeAgentHash } from '../worker/src/utils/sync-state.js';
import { SemanticSyncRunner } from '../worker/src/utils/semantic-sync-runner.js';
import type { EmbeddingProvider, VectorStoreProvider } from '../worker/src/utils/interfaces.js';

describe('Hash stability', () => {
  it('computeAgentHash is stable across nested object key reordering', () => {
    const a = {
      chainId: 11155111,
      agentId: '11155111:1',
      name: 'Agent',
      description: 'Desc',
      capabilities: ['a', 'b'],
      defaultInputModes: ['text'],
      defaultOutputModes: ['json'],
      tags: ['reputation'],
      metadata: {
        z: 1,
        a: { y: true, x: false },
      },
    };

    const b = {
      chainId: 11155111,
      agentId: '11155111:1',
      name: 'Agent',
      description: 'Desc',
      capabilities: ['a', 'b'],
      defaultInputModes: ['text'],
      defaultOutputModes: ['json'],
      tags: ['reputation'],
      metadata: {
        a: { x: false, y: true },
        z: 1,
      },
    };

    expect(computeAgentHash(a as any)).toBe(computeAgentHash(b as any));
  });

  it('SemanticSyncRunner record conversion normalizes set-like arrays so hashes match', () => {
    const embeddingProvider: EmbeddingProvider = {
      async generateEmbedding() {
        return [0];
      },
      prepareAgentText() {
        return '';
      },
    };

    const vectorStoreProvider: VectorStoreProvider = {
      async upsert() {},
      async query() {
        return [];
      },
      async delete() {},
    };

    const runner = new SemanticSyncRunner({
      stateStore: {
        async getLastUpdatedAt() {
          return '0';
        },
        async setLastUpdatedAt() {},
        async getAgentHashes() {
          return {};
        },
        async upsertAgentHashes() {},
        async deleteAgentHashes() {},
      },
      embeddingProvider,
      vectorStoreProvider,
      targets: [],
    });

    const agent1 = {
      id: '11155111:1',
      chainId: '11155111',
      agentId: '11155111:1',
      updatedAt: '10',
      createdAt: '1',
      owner: '0xabc',
      operators: ['0x2', '0x1', '0x1'],
      registrationFile: {
        id: 'tx:cid',
        name: 'Agent',
        description: 'Desc',
        supportedTrusts: ['reputation', 'crypto-economic'],
        mcpTools: ['b', 'a', 'a'],
        mcpPrompts: ['p2', 'p1'],
        mcpResources: ['r1'],
        a2aSkills: ['s2', 's1'],
        mcpEndpoint: 'https://mcp',
        a2aEndpoint: 'https://a2a',
      },
    };

    const agent2 = {
      ...agent1,
      operators: ['0x1', '0x2'],
      registrationFile: {
        ...agent1.registrationFile,
        supportedTrusts: ['crypto-economic', 'reputation'],
        mcpTools: ['a', 'b'],
        mcpPrompts: ['p1', 'p2'],
        a2aSkills: ['s1', 's2'],
      },
    };

    // Call private method via runtime indexing (private is TS-only)
    const rec1 = (runner as any).convertToSemanticAgentRecord(agent1);
    const rec2 = (runner as any).convertToSemanticAgentRecord(agent2);

    expect(computeAgentHash(rec1)).toBe(computeAgentHash(rec2));
  });
});


