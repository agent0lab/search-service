# Agent0 Semantic Search Service

Standalone semantic search service for ERC-8004 agents using Cloudflare Workers, Venice AI embeddings, and Pinecone vector storage.

## Features

- **Semantic Search**: Natural language queries to find relevant agents
- **Automatic Indexing**: Scheduled cron jobs to keep index in sync with ERC-8004 registry
- **Vector Embeddings**: Uses Venice AI for high-quality embeddings
- **Vector Storage**: Pinecone for scalable vector search
- **Queue-Based Processing**: Cloudflare Queues for reliable indexing operations
- **State Management**: D1 database for sync state and configuration
- **Serverless**: Deployed on Cloudflare Workers for global edge deployment
- **Open Source**: MIT licensed, self-hostable

## Architecture

- **Search API**: Stateless Cloudflare Worker handling search queries
- **Indexing Service**: Automated sync via cron jobs (every 15 minutes by default)
- **Queue Consumer**: Processes indexing operations asynchronously to avoid rate limits
- **State Storage**: D1 database for sync state and indexing configuration
- **Multi-Chain Support**: Configurable chain list for indexing multiple networks

## Setup

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account (with Workers, D1, and Queues enabled)
- Venice AI API key
- Pinecone account and API key
- Ethereum RPC endpoint (for indexing service)

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
   RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
   ```

3. Set up D1 database (for sync state):
   ```bash
   # Create D1 database (if not already created)
   wrangler d1 create semantic-sync-state
   
   # Apply migrations to local database
   wrangler d1 migrations apply semantic-sync-state --local
   
   # Apply migrations to remote database
   wrangler d1 migrations apply semantic-sync-state --remote
   ```

4. For production, set secrets via Wrangler:
   ```bash
   wrangler secret put VENICE_API_KEY
   wrangler secret put PINECONE_API_KEY
   wrangler secret put PINECONE_INDEX
   wrangler secret put RPC_URL
   ```

## Development

```bash
# Start local development server
npm run dev

# Type check
npm run type-check

# Run tests (requires dev server running)
npm run test

# Run tests in watch mode
npm run test:watch
```

## Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

### Live Deployment

The service is currently deployed at:
**https://agent0-semantic-search.dawid-pisarczyk.workers.dev**

You can test it with:
```bash
# Health check
curl https://agent0-semantic-search.dawid-pisarczyk.workers.dev/health

# Search query
curl -X POST https://agent0-semantic-search.dawid-pisarczyk.workers.dev/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "defi yield optimization", "topK": 5}'
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
    "defaultInputMode": "text",
    "defaultOutputMode": "json"
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
  - `defaultInputMode`: Filter by default input mode (e.g., "text", "mcp")
  - `defaultOutputMode`: Filter by default output mode (e.g., "json")
  - Custom filters: Any metadata field can be filtered (e.g., `chainId`, `active`, `x402support`)

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
- `RPC_URL`: Ethereum RPC endpoint URL (for blockchain access during indexing)

### Optional

- `PINECONE_NAMESPACE`: Pinecone namespace (if using namespaces)

## Indexing Service

The service includes an automated indexing system that syncs the ERC-8004 agent registry:

- **Cron Schedule**: Runs every 15 minutes by default (configurable via D1)
- **Queue-Based**: Uses Cloudflare Queues to handle indexing operations asynchronously
- **Multi-Chain**: Supports indexing multiple chains (default: Sepolia, Base Sepolia, and Polygon Amoy)
- **State Management**: Tracks sync state in D1 database to enable incremental updates
- **Concurrent Sync Protection**: Prevents multiple syncs for the same chain using lock mechanism

### Configuration

Indexing configuration is stored in the D1 database (`indexing_config` table):
- `chains`: JSON array of chain IDs to index (e.g., `["11155111", "84532", "80002"]`)
  - Default: Ethereum Sepolia (11155111), Base Sepolia (84532), Polygon Amoy (80002)
- `cron_interval`: Cron expression for sync frequency (default: `"*/15 * * * *"`)

### Sync Logs

All cron job runs are logged to the `sync_logs` table in D1, including:
- Start/end times
- Chains processed
- Agents indexed/deleted
- Success/error status

### Local Development

For local testing with remote D1 database:
```bash
# Use --remote flag to connect to production D1 database
npx wrangler dev --remote
```

For initial full sync (bypasses Workers timeout limits):
```bash
npm run sync:direct
```

For testing cron jobs locally:
```bash
npm run dev:test-cron
```

## Testing

The project includes comprehensive tests using Vitest:

- **Unit/Integration Tests** (`tests/search.test.ts`): Tests API endpoints, request validation, and response formats
- **Integration Tests** (`tests/integration.test.ts`): End-to-end tests against the running dev server

To run tests:

1. Start the dev server in one terminal:
   ```bash
   npm run dev
   ```

2. Run tests in another terminal:
   ```bash
   npm run test
   ```

The tests verify:
- Health check endpoint functionality
- Search endpoint request validation
- Response format correctness
- Error handling (404, 400, etc.)
- Filter and parameter handling

## Project Structure

```
search-service/
├── worker/                    # Cloudflare Workers code
│   └── src/
│       ├── routes/            # API route handlers
│       │   ├── health.ts      # Health check endpoint
│       │   └── search.ts      # Search endpoint
│       ├── services/           # Service implementations
│       │   └── indexing-service.ts  # Indexing service (legacy, not used in queue-based flow)
│       ├── utils/              # Utilities and providers
│       │   ├── providers/      # Embedding and vector store providers
│       │   │   ├── venice-embedding.ts
│       │   │   └── pinecone-vector-store.ts
│       │   ├── d1-sync-state-store.ts  # D1-based sync state storage
│       │   ├── config-store.ts         # D1-based configuration storage
│       │   ├── sync-logger.ts          # Sync logging utility
│       │   ├── sync-lock.ts            # Concurrent sync lock manager
│       │   ├── manager.ts      # Search manager
│       │   ├── config.ts       # Provider configuration
│       │   └── types.ts        # Type definitions
│       ├── scheduled.ts        # Cron job handler
│       ├── queue.ts            # Queue consumer handler
│       ├── types.ts            # Environment and type definitions
│       └── index.ts            # Worker entry point
├── migrations/                 # D1 database migrations
│   ├── 0001_initial.sql        # Initial schema (sync_state, indexing_config)
│   ├── 0002_add_sync_logs.sql # Sync logs table
│   └── 0003_add_sync_locks.sql # Sync locks table
├── scripts/                   # Utility scripts
│   ├── sync-local-direct.ts   # Direct local sync script
│   └── test-local-queue.ts    # Local queue testing script
├── tests/                      # Test suite
├── wrangler.toml               # Cloudflare Workers configuration
├── .env.example                # Environment variables template
└── package.json
```

## License

MIT

