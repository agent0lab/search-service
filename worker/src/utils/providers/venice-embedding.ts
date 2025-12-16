import type { SemanticAgentRecord } from '../types.js';
import type { EmbeddingProvider } from '../interfaces.js';

export interface VeniceEmbeddingConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

interface VeniceEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

export class VeniceEmbeddingProvider implements EmbeddingProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: VeniceEmbeddingConfig) {
    if (!config?.apiKey) {
      throw new Error('VeniceEmbeddingProvider requires an apiKey');
    }

    this.apiKey = config.apiKey;
    this.model = config.model ?? 'text-embedding-bge-m3';
    this.baseUrl = config.baseUrl ?? 'https://api.venice.ai/api/v1/embeddings';
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const payload = {
      input: text,
      model: this.model,
      encoding_format: 'float',
    };

    const response = await this.executeRequest(payload);
    return response.data[0]?.embedding ?? [];
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const payload = {
      input: texts,
      model: this.model,
      encoding_format: 'float',
    };

    const response = await this.executeRequest(payload);
    return response.data.map(entry => entry.embedding);
  }

  prepareAgentText(agent: SemanticAgentRecord): string {
    const skills = Array.isArray(agent.tags) ? `Tags: ${agent.tags.join(', ')}` : '';
    const capabilities = Array.isArray(agent.capabilities)
      ? `Capabilities: ${agent.capabilities.join(', ')}`
      : '';
    const inputs = Array.isArray(agent.defaultInputModes)
      ? `Inputs: ${agent.defaultInputModes.join(', ')}`
      : '';
    const outputs = Array.isArray(agent.defaultOutputModes)
      ? `Outputs: ${agent.defaultOutputModes.join(', ')}`
      : '';

    const text = [
      agent.name,
      agent.description,
      skills,
      capabilities,
      inputs,
      outputs,
      this.serializeMetadata(agent.metadata),
    ]
      .filter(Boolean)
      .join('. ');

    // Truncate to approximately 8000 tokens (rough estimate: 1 token ≈ 4 characters)
    // Leave some buffer for safety (8192 token limit)
    const maxChars = 30000; // ~7500 tokens, leaving buffer
    if (text.length > maxChars) {
      return text.substring(0, maxChars);
    }

    return text;
  }

  private async executeRequest(body: Record<string, unknown>): Promise<VeniceEmbeddingResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Venice embedding request failed: ${response.status} ${errorText}`);
      }

      return (await response.json()) as VeniceEmbeddingResponse;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Venice embedding request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private serializeMetadata(metadata?: Record<string, unknown>): string {
    if (!metadata) {
      return '';
    }

    // Only include short, relevant metadata fields for embedding
    // Exclude arrays, long strings, and complex objects
    const entries = Object.entries(metadata)
      .filter(([key, value]) => {
        // Skip arrays (they're already in capabilities/tags)
        if (Array.isArray(value)) {
          return false;
        }
        // Skip complex objects
        if (typeof value === 'object' && value !== null) {
          return false;
        }
        // Only include short strings (max 200 chars) and numbers/booleans
        if (typeof value === 'string' && value.length > 200) {
          return false;
        }
        // Skip certain fields that are too verbose or not useful for semantic search
        const skipFields = ['registrationId', 'image', 'agentWallet', 'mcpEndpoint', 'a2aEndpoint', 'updatedAt', 'createdAt'];
        if (skipFields.includes(key)) {
          return false;
        }
        return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
      })
      .map(([key, value]) => {
        // Truncate long string values
        const strValue = String(value);
        return `${key}: ${strValue.length > 100 ? strValue.substring(0, 100) + '...' : strValue}`;
      });

    return entries.length > 0 ? `Metadata: ${entries.join(', ')}` : '';
  }
}

