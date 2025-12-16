# Agent Search Dashboard

Public-facing agent search dashboard with semantic search capabilities and admin section for managing the search service. Built with Next.js 15 and deployed on Cloudflare Pages.

## Features

### Public Features

- **Semantic Search**: Natural language search for ERC-8004 agents with vector similarity matching
- **Advanced Filtering**: Comprehensive filter system supporting:
  - **Standard Filters**: Name substring search, chain ID, capabilities, tags
  - **Metadata Filters**: Active status, x402 support, MCP/A2A endpoints, ENS, DID
  - **Array Filters**: Supported trusts, MCP tools/prompts/resources, A2A skills
  - **Owner/Operators**: Filter by agent owner or operator addresses
  - **Wallet Address**: Filter by agent wallet address
- **Multi-Chain Search**: Search across multiple blockchain networks simultaneously
- **Sorting**: Sort results by score, updatedAt, createdAt, name, and other metadata fields
- **Pagination**: Cursor-based and offset-based pagination for large result sets
- **Agent Details**: Explore comprehensive agent information including:
  - Registration details (name, description, image)
  - Endpoints (MCP, A2A, ENS, DID)
  - Capabilities (tools, prompts, resources, skills)
  - Trust models and metadata
  - On-chain registration data
  - Off-chain A2A card data (when available)

### Admin Features (Authenticated)

- **SIWE Authentication**: Sign in with Ethereum wallet using Sign-In with Ethereum (SIWE)
- **Wallet Whitelist**: Only whitelisted addresses can access admin section
- **Search Logs**: View and filter search request logs with:
  - Query text, filters, and parameters
  - Response counts and duration
  - IP addresses and timestamps
  - Error tracking
- **Indexing Logs**: Monitor indexing sync operations with:
  - Sync run statistics (agents indexed/deleted, batches processed)
  - Per-chain sync status
  - Detailed batch-level events
  - Error messages and duration tracking
- **Dashboard Stats**: Overview of service metrics including:
  - Total search requests
  - Recent indexing activity
  - Service health status
- **Whitelist Management**: Add/remove admin wallet addresses from the whitelist

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the values:

```bash
cp .env.local.example .env.local
```

**Required variables:**

- `SIWE_DOMAIN`: Domain for SIWE (e.g., `localhost:3000` for dev, your domain for prod)
  - Must match the domain where the app is hosted
  - Used for SIWE message generation and validation
- `SIWE_SECRET`: Secret key for JWT tokens (use a strong random string)
  - Generate with: `openssl rand -base64 32`
  - Keep this secret and use different values for dev/prod
- `NEXT_PUBLIC_APP_URL`: Public URL of the app
  - Dev: `http://localhost:3000`
  - Prod: `https://your-domain.com`
- `NEXT_PUBLIC_WORKER_URL`: URL of the search service worker
  - Example: `https://agent0-semantic-search.dawid-pisarczyk.workers.dev`
  - Must point to a deployed instance of the search service
- `RPC_URL`: Ethereum RPC endpoint for agent details (server-side only)
  - Used to fetch agent registration data from blockchain
  - Example: `https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY`

**Example `.env.local`:**

```bash
SIWE_DOMAIN=localhost:3000
SIWE_SECRET=your-strong-random-secret-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WORKER_URL=https://agent0-semantic-search.dawid-pisarczyk.workers.dev
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
```

### 3. Apply Database Migration

The dashboard shares the same D1 database as the search service. The whitelist table needs to be created:

```bash
cd ..
wrangler d1 migrations apply semantic-sync-state --remote
```

This applies all migrations including `0006_add_admin_whitelist.sql` which creates the `admin_whitelist` table.

### 4. Add Your Wallet to Whitelist

After applying the migration, add your wallet address to the whitelist to access the admin section:

```bash
cd ..
wrangler d1 execute semantic-sync-state --command "INSERT INTO admin_whitelist (wallet_address, added_at, added_by) VALUES (LOWER('YOUR_ADDRESS'), datetime('now'), 'initial')" --remote
```

Replace `YOUR_ADDRESS` with your Ethereum wallet address (e.g., `0x1234...5678`). The address will be automatically lowercased.

**Note**: You can also add addresses through the admin dashboard once you have access.

## Development

### Local Development

```bash
npm run dev
```

This starts the Next.js dev server on `http://localhost:3000` using the Node.js runtime.

### Preview with Cloudflare Runtime

To test with the actual Cloudflare Workers runtime (matches production environment):

```bash
npm run preview
```

This builds the app and runs it locally using `wrangler dev` with the Cloudflare runtime.

### Development with Remote D1

To test with remote D1 database (shared with production):

```bash
npm run dev:remote
```

This connects to the remote D1 database instead of a local one.

## Deployment

### Deploy to Cloudflare Pages

The dashboard is configured to deploy to Cloudflare Pages using the OpenNext adapter:

```bash
npm run deploy
```

This builds the app using OpenNext and deploys it to Cloudflare Pages.

### Environment Variables in Cloudflare

Set these in the Cloudflare dashboard:

1. Go to **Workers & Pages** > Your Project > **Settings** > **Variables**
2. Add the following environment variables:

**Required:**
- `SIWE_DOMAIN`: Your production domain (e.g., `your-domain.com`)
- `SIWE_SECRET`: Your production secret (different from dev, use a strong random string)
- `NEXT_PUBLIC_APP_URL`: Your production URL (e.g., `https://your-domain.com`)
- `NEXT_PUBLIC_WORKER_URL`: Your search service worker URL
- `RPC_URL`: Ethereum RPC endpoint (server-side only)

**D1 Database Binding:**

The D1 database binding is configured in `wrangler.toml` and will be automatically available in production. Ensure the database name matches your search service database:

```toml
[[d1_databases]]
binding = "DB"
database_name = "semantic-sync-state"
database_id = "your-database-id"
```

### Domain Configuration

1. In Cloudflare Pages dashboard, go to **Custom domains**
2. Add your custom domain
3. Follow the DNS configuration instructions
4. Update `SIWE_DOMAIN` and `NEXT_PUBLIC_APP_URL` environment variables to match your domain

### Build Configuration

The dashboard uses:
- **Build command**: `npm run build`
- **Output directory**: `.open-next`
- **Node version**: 18.x (configured in `wrangler.toml`)

## Architecture

- **Next.js 15** with App Router for modern React development
- **OpenNext Cloudflare Adapter** for seamless Cloudflare Workers deployment
- **Edge Runtime** for API routes (faster response times)
- **D1 Database** for data storage (shared with search-service)
- **SIWE** for wallet authentication (admin section)
- **wagmi + viem** for Ethereum wallet connection and interaction
- **agent0-sdk** for agent details and blockchain interaction
- **shadcn/ui** for accessible, customizable UI components
- **Tailwind CSS** for utility-first styling

### Key Components

- **Search Page** (`app/search/page.tsx`): Main search interface with filters and results
- **Agent Detail Pages** (`app/agents/[agentId]/page.tsx`): Individual agent information pages
- **Admin Dashboard** (`app/dashboard/*`): Protected admin routes for monitoring and management
- **API Routes** (`app/api/*`): Server-side API endpoints for agent data and admin operations
- **Middleware** (`middleware.ts`): Route protection and authentication

## Security

- **Edge Runtime**: All API routes use edge runtime for faster, more secure execution
- **Environment Variables**: Server-side only, never exposed to client
- **JWT Tokens**: Stored in httpOnly cookies to prevent XSS attacks
- **Whitelist Check**: Every authenticated request verifies wallet address against whitelist
- **SQL Injection Protection**: All database queries use parameterized statements
- **Route Protection**: `/dashboard/*` routes protected by middleware
- **CORS**: Properly configured for API access
- **SIWE Validation**: Server-side validation of SIWE messages and signatures

## Project Structure

```
agent-search-dashboard/
├── app/
│   ├── api/                    # API routes (edge runtime)
│   │   ├── agents/             # Agent details API
│   │   │   └── [agentId]/
│   │   │       └── route.ts
│   │   └── admin/              # Admin APIs
│   │       ├── search-logs/
│   │       ├── indexing-logs/
│   │       ├── stats/
│   │       └── whitelist/
│   ├── agents/                 # Agent detail pages (public)
│   │   └── [agentId]/
│   │       └── page.tsx
│   ├── dashboard/              # Admin pages (protected)
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Dashboard home
│   │   ├── search-logs/
│   │   ├── indexing-logs/
│   │   └── whitelist/
│   ├── api-docs/               # API documentation page
│   │   └── page.tsx
│   ├── search/                 # Search page
│   │   └── page.tsx
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Homepage (redirects to search)
├── components/                  # React components
│   ├── ui/                     # shadcn/ui components
│   └── ...
├── lib/                        # Utilities and types
│   ├── search-client.ts        # Search API client
│   ├── types.ts                # TypeScript types
│   ├── get-db.ts               # D1 database utilities
│   └── ...
├── middleware.ts                # Route protection
├── wrangler.toml               # Cloudflare configuration
└── package.json
```

## Troubleshooting

### Authentication Issues

- **"Not whitelisted" error**: Ensure your wallet address is added to the `admin_whitelist` table in D1
- **SIWE signature fails**: Verify `SIWE_DOMAIN` matches your actual domain exactly
- **JWT token invalid**: Check that `SIWE_SECRET` is set correctly and hasn't changed

### Database Issues

- **"D1 database not available"**: Ensure D1 binding is configured in `wrangler.toml` and database exists
- **Migration errors**: Run migrations with `wrangler d1 migrations apply semantic-sync-state --remote`

### Search API Issues

- **"Failed to fetch" errors**: Verify `NEXT_PUBLIC_WORKER_URL` points to a valid, deployed search service
- **CORS errors**: Ensure the search service has CORS enabled for your domain

### Build Issues

- **OpenNext build fails**: Ensure Node.js 18+ is installed and all dependencies are up to date
- **Type errors**: Run `npm run type-check` to identify TypeScript issues

## License

MIT
