# Agent0 Semantic Search Service

Standalone semantic search service for ERC-8004 agents using Cloudflare Workers, Venice AI embeddings, and Pinecone vector storage. This service implements the [Universal Agent Semantic Search API Standard v1.0](./docs/AG0_SEMANTIC_SEARCH_STANDARD.md), enabling hot-swappable providers and standardized client interfaces.

The service also includes a [public-facing dashboard](./agent-search-dashboard/README.md) for searching and exploring agents, with an admin section for monitoring and managing the service.

## Features

- **Semantic Search**: Natural language queries to find relevant agents
- **Automatic Indexing**: Scheduled cron jobs to keep index in sync with ERC-8004 registry
- **Vector Embeddings**: Uses Venice AI for high-quality embeddings
- **Vector Storage**: Pinecone for scalable vector search
- **Queue-Based Processing**: Cloudflare Queues for reliable indexing operations
- **State Management**: D1 database for sync state and configuration
- **Serverless**: Deployed on Cloudflare Workers for global edge deployment
- **Standard API**: Implements Universal Agent Semantic Search API Standard v1.0
- **Open Source**: MIT licensed, self-hostable

## Architecture

- **Search API**: Stateless Cloudflare Worker handling search queries
- **Indexing Service**: Automated sync via cron jobs (every 15 minutes by default)
- **Queue Consumer**: Processes indexing operations asynchronously to avoid rate limits
- **State Storage**: D1 database for sync state and indexing configuration
- **Multi-Chain Support**: Configurable chain list for indexing multiple networks

## Prerequisites

Before setting up the service, ensure you have:

- **Node.js 18+** and npm installed
- **Cloudflare account** with the following enabled:
  - Cloudflare Workers (free tier available)
  - D1 Database (free tier available)
  - Cloudflare Queues (paid plan 5$ a month)
- **Venice AI account** and API key ([get one here](https://venice.ai))
- **Pinecone account**, API key, and index ([get one here](https://www.pinecone.io))
- **Ethereum RPC endpoint** (for indexing service to access blockchain data)
  - Options: Alchemy, Infura, QuickNode, or your own node

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/agent0lab/search-service
   cd search-service
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Cloudflare Setup

### 1. D1 Database Setup

The service uses D1 database for storing sync state, configuration, logs, and rate limiting data.

**Create the database:**
```bash
wrangler d1 create semantic-sync-state
```

This will output a `database_id`. **Update `wrangler.toml`** with this ID:
```toml
[[d1_databases]]
binding = "DB"
database_name = "semantic-sync-state"
database_id = "YOUR_DATABASE_ID_HERE"  # Replace with the ID from above
```

**Apply migrations:**

The service requires 7 migrations to set up all necessary tables:

```bash
# Apply to local database (for development)
wrangler d1 migrations apply semantic-sync-state --local

# Apply to remote database (for production)
wrangler d1 migrations apply semantic-sync-state --remote
```

**Migration Overview:**

1. **0001_initial.sql**: Creates `sync_state` (tracks per-chain sync state) and `indexing_config` (stores configuration like chains list and cron interval)
2. **0002_add_sync_logs.sql**: Creates `sync_logs` table for tracking indexing runs with statistics
3. **0003_add_sync_locks.sql**: Creates `sync_locks` table to prevent concurrent syncs for the same chain
4. **0004_add_request_logs.sql**: Creates `request_logs` table for tracking search requests (used by dashboard)
5. **0005_add_rate_limit_tracking.sql**: Creates `rate_limit_tracking` table for IP-based rate limiting
6. **0006_add_admin_whitelist.sql**: Creates `admin_whitelist` table for dashboard admin authentication
7. **0007_add_sync_log_events.sql**: Creates `sync_log_events` table for detailed batch-level indexing event logging

### 2. Cloudflare Queue Setup

The queue is automatically configured in `wrangler.toml`:

```toml
[[queues.producers]]
queue = "indexing-queue"
binding = "INDEXING_QUEUE"

[[queues.consumers]]
queue = "indexing-queue"
max_batch_size = 10
max_batch_timeout = 30
```

The queue will be automatically created on first deployment. No manual setup required.

**How it works:**
- The cron job (scheduled trigger) sends messages to the queue for each chain
- The queue consumer processes indexing operations asynchronously
- This prevents timeout issues and allows for better error handling

### 3. Workers Configuration

The service is configured with:

- **Cron triggers**: Runs every 15 minutes (`*/15 * * * *`) to trigger indexing
- **Observability**: Logs enabled for monitoring and debugging
- **Environment bindings**: D1 database and Queue bindings configured

All configuration is in `wrangler.toml` and doesn't require manual setup.

## Venice AI Setup

Venice AI provides the embedding service for converting agent text into vector embeddings.

1. **Create an account**: Sign up at [venice.ai](https://venice.ai)

2. **Get your API key**: 
   - Navigate to your account settings
   - Copy your API key

3. **Configure the key**:
   - For local development: Add to `.dev.vars` (see Configuration section)
   - For production: Set via `wrangler secret put VENICE_API_KEY`

**Token Limits:**
- Venice AI has a token limit of 8192 tokens per request
- The service automatically truncates long text to stay within limits
- Batch embedding is supported but falls back to individual processing if limits are exceeded

## Pinecone Setup

Pinecone is used as the vector database for storing and searching embeddings.

1. **Create an account**: Sign up at [pinecone.io](https://www.pinecone.io)

2. **Create an index**:
   - Go to your Pinecone dashboard
   - Create a new index with these settings:
     - **Dimensions**: 1024 (Venice AI embedding dimension)
     - **Metric**: cosine (recommended for semantic search)
     - **Name**: Choose a name (e.g., `agent0-semantic-search`)

3. **Get your API key**:
   - Navigate to API Keys in your dashboard
   - Copy your API key

4. **Configure**:
   - For local development: Add to `.dev.vars` (see Configuration section)
   - For production: Set via `wrangler secret put PINECONE_API_KEY` and `wrangler secret put PINECONE_INDEX`

**Optional: Namespaces**
- If you want to use namespaces for multi-tenant or environment separation, set `PINECONE_NAMESPACE` in your environment variables

## Configuration

### Local Development

1. Create `.dev.vars` file in the project root:
   ```bash
   cp .env.example .dev.vars
   ```

2. Fill in your API keys and configuration:
   ```bash
   VENICE_API_KEY=your_venice_api_key_here
   PINECONE_API_KEY=your_pinecone_api_key_here
   PINECONE_INDEX=your_index_name_here
   RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
   
   # Optional
   PINECONE_NAMESPACE=your_namespace_here
   ```

### Production

Set secrets via Wrangler CLI:

```bash
wrangler secret put VENICE_API_KEY
wrangler secret put PINECONE_API_KEY
wrangler secret put PINECONE_INDEX
wrangler secret put RPC_URL

# Optional
wrangler secret put PINECONE_NAMESPACE
```

Each command will prompt you to enter the secret value.

### Environment Variables

**Required:**
- `VENICE_API_KEY`: Venice AI API key for embeddings
- `PINECONE_API_KEY`: Pinecone API key
- `PINECONE_INDEX`: Pinecone index name
- `RPC_URL`: Ethereum RPC endpoint URL (for blockchain access during indexing)

**Optional:**
- `PINECONE_NAMESPACE`: Pinecone namespace (if using namespaces)

## Initialization

After setting up Cloudflare resources and configuring API keys, you need to initialize the service:

### 1. Verify Database Setup

Ensure all migrations are applied:
```bash
wrangler d1 migrations apply semantic-sync-state --remote
```

### 2. Initialize Default Configuration

The service will automatically initialize default configuration on first run, but you can verify it:

```bash
# Check configured chains
wrangler d1 execute semantic-sync-state --command "SELECT * FROM indexing_config WHERE key = 'chains'" --remote
```

Default chains: Ethereum Sepolia (11155111), Base Sepolia (84532), Polygon Amoy (80002)

### 3. Run Initial Sync

For the first sync, you can either:

**Option A: Wait for cron job** (recommended for production)
- The cron job runs every 15 minutes
- It will automatically start indexing configured chains

**Option B: Manual sync** (for testing or faster initial setup)
```bash
npm run sync:direct
```

This runs a direct sync script that bypasses Workers timeout limits.

### 4. Verify Setup

Check that indexing is working:

```bash
# Check sync logs
wrangler d1 execute semantic-sync-state --command "SELECT * FROM sync_logs ORDER BY started_at DESC LIMIT 5" --remote

# Check sync state
wrangler d1 execute semantic-sync-state --command "SELECT * FROM sync_state" --remote
```

### 5. Test the API

Once indexed, test the search API:

```bash
# Health check
curl https://your-worker.workers.dev/v1/health

# Search query
curl -X POST https://your-worker.workers.dev/v1/search \
  -H "Content-Type: application/json" \
  -d '{"query": "defi yield optimization", "limit": 5}'
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

### Local Development with Remote D1

To test with remote D1 database:
```bash
npx wrangler dev --remote
```

### Testing Cron Jobs Locally

```bash
npm run dev:test-cron
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
curl https://agent0-semantic-search.dawid-pisarczyk.workers.dev/v1/health

# Search query
curl -X POST https://agent0-semantic-search.dawid-pisarczyk.workers.dev/v1/search \
  -H "Content-Type: application/json" \
  -d '{"query": "defi yield optimization", "limit": 5}'
```

## API Documentation

This service implements the [Universal Agent Semantic Search API Standard v1.0](./docs/AG0_SEMANTIC_SEARCH_STANDARD.md). For complete API documentation, see the standard specification.

### Key Endpoints

- **GET `/v1/capabilities`**: Discover provider capabilities and supported features
- **GET `/v1/health`**: Check service health and availability
- **POST `/v1/search`**: Perform semantic search query

### Example Search Request

```json
{
  "query": "find agents that help with DeFi yield optimization",
  "limit": 10,
  "filters": {
    "equals": {
      "active": true,
      "x402support": true
    },
    "in": {
      "chainId": [11155111, 84532],
      "supportedTrusts": ["reputation"],
      "mcpTools": ["code_generation"]
    },
    "exists": ["mcpEndpoint", "agentURI"]
  },
  "minScore": 0.5
}
```

See the [standard specification](./docs/AG0_SEMANTIC_SEARCH_STANDARD.md) for complete API documentation, including all filter operators, metadata fields, pagination, and error handling.

## Dashboard

The service includes a public-facing dashboard for searching and exploring agents. The dashboard provides:

- **Public Features**: Semantic search, advanced filtering, agent detail pages
- **Admin Features**: Search logs, indexing logs, dashboard statistics, whitelist management

For setup and deployment instructions, see the [dashboard README](./agent-search-dashboard/README.md).

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

Detailed batch-level events are logged to `sync_log_events` for granular monitoring.

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
├── docs/                        # Documentation
│   └── AG0_SEMANTIC_SEARCH_STANDARD.md  # API Standard v1.0
├── worker/                      # Cloudflare Workers code
│   └── src/
│       ├── routes/              # API route handlers
│       │   ├── v1/              # v1 API endpoints
│       │   │   ├── capabilities.ts
│       │   │   ├── health.ts
│       │   │   ├── search.ts
│       │   │   └── schemas.ts
│       │   ├── health.ts        # Legacy health endpoint
│       │   └── search.ts        # Legacy search endpoint
│       ├── services/             # Service implementations
│       ├── utils/                # Utilities and providers
│       │   ├── providers/        # Embedding and vector store providers
│       │   │   ├── venice-embedding.ts
│       │   │   └── pinecone-vector-store.ts
│       │   ├── d1-sync-state-store.ts
│       │   ├── config-store.ts
│       │   ├── sync-logger.ts
│       │   ├── sync-lock.ts
│       │   ├── manager.ts
│       │   └── ...
│       ├── scheduled.ts          # Cron job handler
│       ├── queue.ts              # Queue consumer handler
│       ├── types.ts               # Environment and type definitions
│       └── index.ts               # Worker entry point
├── agent-search-dashboard/       # Dashboard application
├── migrations/                   # D1 database migrations
│   ├── 0001_initial.sql
│   ├── 0002_add_sync_logs.sql
│   ├── 0003_add_sync_locks.sql
│   ├── 0004_add_request_logs.sql
│   ├── 0005_add_rate_limit_tracking.sql
│   ├── 0006_add_admin_whitelist.sql
│   └── 0007_add_sync_log_events.sql
├── scripts/                      # Utility scripts
│   ├── sync-local-direct.ts      # Direct local sync script
│   ├── reindex-metadata.ts       # Metadata reindexing script
│   └── test-local-queue.ts       # Local queue testing script
├── tests/                        # Test suite
├── wrangler.toml                 # Cloudflare Workers configuration
├── .env.example                  # Environment variables template
└── package.json
```

## Roadmap

Future enhancements planned for the service:

### Authentication Systems
- **x402 (ERC-402) Support**: Payment-based authentication using ERC-402 tokens for API access
- **API Key Authentication**: Traditional API key-based authentication for programmatic access
- **Additional Auth Methods**: Support for OAuth2, JWT, and other authentication mechanisms

### Provider Support
- **Additional Embedding Providers**: Support for OpenAI, Cohere, Hugging Face, and other embedding providers beyond Venice AI
- **Additional Vector Databases**: Support for Weaviate, Qdrant, Milvus, and other vector databases beyond Pinecone
- **Provider Hot-Swapping**: Runtime configuration to switch between providers without code changes

These enhancements will maintain backward compatibility with the existing API standard while providing more flexibility and options for deployment.

## License

MIT
