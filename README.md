# Agent0 Semantic Search Service

Standalone semantic search service for ERC-8004 agents using Cloudflare Workers, Venice AI embeddings, and Pinecone vector storage.

## Features

- **Semantic Search**: Natural language queries to find relevant agents
- **Vector Embeddings**: Uses Venice AI for high-quality embeddings
- **Vector Storage**: Pinecone for scalable vector search
- **Serverless**: Deployed on Cloudflare Workers for global edge deployment
- **Open Source**: MIT licensed, self-hostable

## Architecture

- **Search API**: Stateless Cloudflare Worker handling search queries
- **Indexing**: Scheduled cron jobs (coming soon) to keep index in sync
- **State Storage**: D1 database for sync state (coming soon)

## Setup

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account
- Venice AI API key
- Pinecone account and API key

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env.example` to `.dev.vars` for local development:
   ```bash
   cp .env.example .dev.vars
   ```

2. Fill in your API keys in `.dev.vars`:
   ```bash
   VENICE_API_KEY=your_venice_key
   PINECONE_API_KEY=your_pinecone_key
   PINECONE_INDEX=your_index_name
   ```

3. For production, set secrets via Wrangler:
   ```bash
   wrangler secret put VENICE_API_KEY
   wrangler secret put PINECONE_API_KEY
   wrangler secret put PINECONE_INDEX
   ```

## Development

```bash
# Start local development server
npm run dev

# Type check
npm run type-check
```

## Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## API Documentation

### POST /api/search

Perform a semantic search for agents.

**Request Body:**
```json
{
  "query": "find agents that help with DeFi yield optimization",
  "topK": 5,
  "minScore": 0.5,
  "filters": {
    "capabilities": ["defi", "yield"],
    "inputMode": "text",
    "outputMode": "json"
  }
}
```

**Response:**
```json
{
  "query": "find agents that help with DeFi yield optimization",
  "results": [
    {
      "rank": 1,
      "vectorId": "11155111-11155111:123",
      "agentId": "11155111:123",
      "chainId": 11155111,
      "name": "Portfolio Navigator",
      "description": "Analyzes DeFi portfolios...",
      "score": 0.89,
      "metadata": { ... },
      "matchReasons": ["Excellent semantic match"]
    }
  ],
  "total": 1,
  "timestamp": "2024-11-25T12:00:00.000Z"
}
```

**Query Parameters:**
- `query` (required): Natural language search query
- `topK` (optional): Number of results to return (default: 5)
- `minScore` (optional): Minimum similarity score threshold
- `filters` (optional): Metadata filters
  - `capabilities`: Array of capability strings
  - `inputMode`: Filter by input mode
  - `outputMode`: Filter by output mode

### GET /health

Check service health and connectivity.

**Response:**
```json
{
  "status": "ok",
  "services": {
    "venice": "ok",
    "pinecone": "ok"
  },
  "timestamp": "2024-11-25T12:00:00.000Z"
}
```

## Environment Variables

### Required

- `VENICE_API_KEY`: Venice AI API key for embeddings
- `PINECONE_API_KEY`: Pinecone API key
- `PINECONE_INDEX`: Pinecone index name

### Optional

- `PINECONE_NAMESPACE`: Pinecone namespace (if using namespaces)

## Project Structure

```
search-service/
├── utils/              # Semantic search core code
│   ├── providers/      # Embedding and vector store providers
│   ├── manager.ts      # Search manager
│   ├── config.ts       # Provider configuration
│   └── types.ts        # Type definitions
├── worker/             # Cloudflare Workers code
│   └── src/
│       ├── routes/     # API route handlers
│       └── index.ts    # Worker entry point
├── wrangler.toml       # Cloudflare Workers configuration
└── package.json
```

## License

MIT

