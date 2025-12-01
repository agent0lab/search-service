# Agent Search Dashboard

Public-facing agent search dashboard with semantic search capabilities and admin section for managing the search service.

## Features

### Public Features
- **Semantic Search**: Natural language search for ERC-8004 agents
- **Advanced Filters**: Filter by capabilities, input/output modes, and more
- **Agent Details**: Explore comprehensive agent information including:
  - Registration details (name, description, image)
  - Endpoints (MCP, A2A, ENS, DID)
  - Capabilities (tools, prompts, resources, skills)
  - Trust models and metadata

### Admin Features (Authenticated)
- **SIWE Authentication**: Sign in with Ethereum wallet
- **Wallet Whitelist**: Only whitelisted addresses can access admin section
- **Search Logs**: View and filter search request logs
- **Indexing Logs**: Monitor indexing sync operations with detailed batch events
- **Dashboard Stats**: Overview of service metrics and statistics
- **Whitelist Management**: Add/remove admin wallet addresses

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

Required variables:
- `SIWE_DOMAIN`: Domain for SIWE (e.g., `localhost:3000` for dev, your domain for prod)
- `SIWE_SECRET`: Secret key for JWT tokens (use a strong random string)
- `NEXT_PUBLIC_APP_URL`: Public URL of the app
- `NEXT_PUBLIC_WORKER_URL`: URL of the search service worker (e.g., `https://agent0-semantic-search.dawid-pisarczyk.workers.dev`)
- `RPC_URL`: Ethereum RPC endpoint for agent details (server-side only)

### 3. Apply Database Migration

The whitelist table needs to be created in the D1 database:

```bash
cd ..
wrangler d1 migrations apply semantic-sync-state --remote
```

### 4. Add Your Wallet to Whitelist

After applying the migration, add your wallet address to the whitelist:

```bash
cd ..
wrangler d1 execute semantic-sync-state --command "INSERT INTO admin_whitelist (wallet_address, added_at, added_by) VALUES (LOWER('YOUR_ADDRESS'), datetime('now'), 'initial')" --remote
```

Replace `YOUR_ADDRESS` with your Ethereum wallet address.

## Development

### Local Development

```bash
npm run dev
```

This uses the Next.js dev server (Node.js runtime).

### Preview with Cloudflare Runtime

To test with the actual Cloudflare Workers runtime:

```bash
npm run preview
```

This builds the app and runs it locally using `wrangler dev` with the Cloudflare runtime.

### Development with Remote D1

To test with remote D1 database:

```bash
npm run dev:remote
```

## Deployment

### Deploy to Cloudflare Workers

```bash
npm run deploy
```

This builds the app using OpenNext and deploys it to Cloudflare Workers.

### Environment Variables in Cloudflare

Set these in the Cloudflare dashboard (Workers & Pages > Your Project > Settings > Variables):

- `SIWE_DOMAIN`: Your production domain
- `SIWE_SECRET`: Your production secret (different from dev)
- `NEXT_PUBLIC_APP_URL`: Your production URL
- `NEXT_PUBLIC_WORKER_URL`: Your search service worker URL
- `RPC_URL`: Ethereum RPC endpoint (server-side only)

The D1 database binding is configured in `wrangler.toml` and will be automatically available.

## Architecture

- **Next.js 15** with App Router
- **OpenNext Cloudflare Adapter** for Cloudflare Workers deployment
- **Edge Runtime** for API routes
- **D1 Database** for data storage (shared with search-service)
- **SIWE** for wallet authentication (admin section)
- **wagmi + viem** for Ethereum wallet connection
- **agent0-sdk** for agent details and blockchain interaction
- **shadcn/ui** for UI components
- **Tailwind CSS** for styling

## Security

- All API routes use edge runtime
- Environment variables are server-side only (never exposed to client)
- JWT tokens stored in httpOnly cookies
- Whitelist check on every authenticated request
- SQL injection protection via parameterized queries
- `/dashboard/*` routes protected by middleware

## Project Structure

```
agent-search-dashboard/
├── app/
│   ├── api/              # API routes (edge runtime)
│   │   ├── agents/       # Agent details API
│   │   └── admin/        # Admin APIs
│   ├── agents/           # Agent detail pages (public)
│   ├── dashboard/        # Admin pages (protected)
│   └── page.tsx          # Search homepage (public)
├── components/           # React components
├── lib/                  # Utilities and types
└── middleware.ts         # Route protection
```
