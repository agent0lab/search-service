import type { SemanticAgentRecord } from '../types.js';
import type { EmbeddingProvider } from '../interfaces.js';

export interface OpenAIEmbeddingConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  apiVersion?: string;
  timeoutMs?: number;
}

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly isAzureOpenAI: boolean;
  private readonly timeoutMs: number;

  constructor(config: OpenAIEmbeddingConfig) {
    if (!config?.apiKey) {
      throw new Error('OpenAIEmbeddingProvider requires an apiKey');
    }

    this.apiKey = config.apiKey;
    this.model = config.model ?? 'text-embedding-3-small';
    const configuredBaseUrl = config.baseUrl ?? 'https://api.openai.com/v1/embeddings';
    this.isAzureOpenAI = this.detectAzureOpenAI(configuredBaseUrl);
    this.baseUrl = this.resolveBaseUrl(configuredBaseUrl, this.model, config.apiVersion);
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const payload = this.isAzureOpenAI
      ? { input: text }
      : {
          input: text,
          model: this.model,
          encoding_format: 'float',
        };

    const response = await this.executeRequest(payload);
    return response.data[0]?.embedding ?? [];
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const payload = this.isAzureOpenAI
      ? { input: texts }
      : {
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

    const maxChars = 30000;
    if (text.length > maxChars) {
      return text.substring(0, maxChars);
    }
    return text;
  }

  private async executeRequest(body: Record<string, unknown>): Promise<OpenAIEmbeddingResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          ...(this.isAzureOpenAI
            ? { 'api-key': this.apiKey }
            : { Authorization: `Bearer ${this.apiKey}` }),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI embedding request failed: ${response.status} ${errorText}`);
      }

      return (await response.json()) as OpenAIEmbeddingResponse;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OpenAI embedding request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private detectAzureOpenAI(url: string): boolean {
    try {
      return new URL(url).hostname.endsWith('.openai.azure.com');
    } catch {
      return false;
    }
  }

  private resolveBaseUrl(baseUrl: string, deployment: string, apiVersion?: string): string {
    if (!this.detectAzureOpenAI(baseUrl)) {
      return baseUrl;
    }

    const parsed = new URL(baseUrl);
    // If full embeddings path already provided, use as-is.
    if (parsed.pathname.includes('/openai/deployments/') && parsed.pathname.includes('/embeddings')) {
      if (!parsed.searchParams.has('api-version')) {
        parsed.searchParams.set('api-version', apiVersion ?? '2023-05-15');
      }
      return parsed.toString();
    }

    parsed.pathname = `/openai/deployments/${encodeURIComponent(deployment)}/embeddings`;
    if (!parsed.searchParams.has('api-version')) {
      parsed.searchParams.set('api-version', apiVersion ?? '2023-05-15');
    }
    return parsed.toString();
  }

  private serializeMetadata(metadata?: Record<string, unknown>): string {
    if (!metadata) return '';

    const entries = Object.entries(metadata)
      .filter(([key, value]) => {
        if (Array.isArray(value)) return false;
        if (typeof value === 'object' && value !== null) return false;
        if (typeof value === 'string' && value.length > 200) return false;
        const skipFields = ['registrationId', 'image', 'agentWallet', 'mcpEndpoint', 'a2aEndpoint', 'updatedAt', 'createdAt'];
        if (skipFields.includes(key)) return false;
        return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
      })
      .map(([key, value]) => {
        const strValue = String(value);
        return `${key}: ${strValue.length > 100 ? strValue.substring(0, 100) + '...' : strValue}`;
      });

    return entries.length > 0 ? `Metadata: ${entries.join(', ')}` : '';
  }
}
