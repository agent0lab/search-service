<!-- 4832dcc4-cbca-46fa-838c-8112fe21aff1 e8f2b4a7-5f8a-4443-bbfd-8b4e64c1f79a -->
# Next.js Admin Dashboard with SIWE Authentication

## Overview

Create a Next.js admin dashboard for monitoring the semantic search service. Features include SIWE authentication, wallet whitelist management, search logs, indexing logs, and analytics.

## Architecture

### Tech Stack

- **Next.js 14+** (App Router with Edge Runtime)
- **SIWE** (Sign-In With Ethereum) for authentication
- **wagmi** + **viem** for Ethereum wallet connection
- **Cloudflare D1 API** for direct database access
- **Tailwind CSS** for styling
- **Radix UI** - Headless, accessible component primitives
- **shadcn/ui** - Beautiful, customizable components built on Radix UI
- **Lucide React** - Modern icon library
- **recharts** or **visx** - Data visualization
- **framer-motion** - Smooth animations and transitions

### Project Structure

```
admin-dashboard/
├── app/
│   ├── layout.tsx
│   ├── page.tsx (login)
│   ├── dashboard/
│   │   ├── layout.tsx (protected)
│   │   ├── page.tsx (overview/stats)
│   │   ├── search-logs/
│   │   │   └── page.tsx
│   │   ├── indexing-logs/
│   │   │   └── page.tsx
│   │   └── whitelist/
│   │       └── page.tsx
│   └── api/
│       ├── auth/
│       │   ├── siwe/route.ts (SIWE challenge/verify)
│       │   └── session/route.ts (check session)
│       └── admin/
│           ├── logs/
│           │   ├── search/route.ts
│           │   └── indexing/route.ts
│           ├── stats/route.ts
│           └── whitelist/route.ts
├── lib/
│   ├── d1-client.ts (Cloudflare D1 API client)
│   ├── siwe.ts (SIWE utilities)
│   ├── auth.ts (session management)
│   └── types.ts
├── components/
│   ├── siwe/
│   │   ├── LoginButton.tsx
│   │   └── WalletConnect.tsx
│   ├── dashboard/
│   │   ├── StatsCards.tsx
│   │   ├── SearchLogsTable.tsx
│   │   ├── IndexingLogsTable.tsx
│   │   └── WhitelistManager.tsx
│   └── ui/ (shadcn components)
└── middleware.ts (auth protection)
```

## Implementation Plan

### 1. Project Setup

**Files:**

- `admin-dashboard/package.json` - Next.js project with dependencies
- `admin-dashboard/next.config.js` - Next.js configuration
- `admin-dashboard/tailwind.config.js` - Tailwind setup
- `admin-dashboard/tsconfig.json` - TypeScript config

**Dependencies:**

- `next`, `react`, `react-dom`
- `siwe` - Sign-In With Ethereum
- `wagmi`, `viem` - Ethereum wallet connection
- `@tanstack/react-query` - Data fetching
- `tailwindcss`, `@tailwindcss/forms`
- `shadcn/ui` components (optional)
- `jose` or `jwt` - JWT session tokens

### 2. D1 Database Access

**File:** `lib/d1-client.ts`

**Option 1 (Preferred):** Use Cloudflare D1 bindings via Pages

- Access D1 database directly through Cloudflare Pages bindings
- No API tokens needed (more secure)
- Requires `wrangler.toml` configuration for Pages

**Option 2 (Fallback):** Use Cloudflare D1 HTTP API client

- Use Cloudflare API token and account ID (server-side only)
- Methods:
  - `query(sql, params)` - Execute SQL queries
  - `getRequestLogs(limit, offset, filters)`
  - `getIndexingLogs(limit, offset, filters)`
  - `getStats(timeRange)`
  - `getWhitelist()`, `addToWhitelist(address)`, `removeFromWhitelist(address)`

**Environment Variables (Server-Side Only - NEVER expose to client):**

- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with D1 read/write (if using HTTP API)
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID (if using HTTP API)
- `D1_DATABASE_ID` - D1 database ID (164eaaf0-6527-4e1b-b859-5805aae1b6c9)
- `SIWE_DOMAIN` - Domain for SIWE (e.g., localhost:3000 for dev, your-domain.pages.dev for prod)
- `SIWE_SECRET` - Secret for signing JWT tokens (use strong random secret)

**Security:**

- All these variables MUST be set in Cloudflare Pages environment variables (not in code)
- Never use `NEXT_PUBLIC_` prefix for secrets
- Access only in API routes (edge runtime) or server components

### 3. Whitelist System

**File:** `migrations/0006_add_admin_whitelist.sql` (in search-service)

- Create `admin_whitelist` table:
  - `id` (INTEGER PRIMARY KEY)
  - `wallet_address` (TEXT UNIQUE NOT NULL) - Lowercase Ethereum address
  - `added_at` (TEXT) - ISO timestamp
  - `added_by` (TEXT) - Address of admin who added it

- Initial migration: Add your wallet address

### 4. SIWE Authentication

**Files:**

- `lib/siwe.ts` - SIWE message generation and verification
- `app/api/auth/siwe/route.ts` - SIWE challenge and verification endpoints
- `components/siwe/LoginButton.tsx` - SIWE login component
- `components/siwe/WalletConnect.tsx` - Wallet connection UI

**Flow:**

1. User connects wallet (MetaMask)
2. User clicks "Sign In"
3. Generate SIWE message with nonce
4. User signs message with wallet
5. Verify signature on server
6. Check if wallet is in whitelist
7. Create JWT session token
8. Store in httpOnly cookie

**SIWE Message Format:**

```
{domain} wants you to sign in with your Ethereum account:
{address}

URI: {uri}
Version: 1
Chain ID: 1
Nonce: {nonce}
Issued At: {timestamp}
```

### 5. Session Management

**Files:**

- `lib/auth.ts` - Session utilities
- `app/api/auth/session/route.ts` - Session check endpoint
- `middleware.ts` - Protect dashboard routes

**Session Storage:**

- JWT token in httpOnly cookie
- Contains: wallet address, issued at, expires at
- Verify on each protected route

### 6. Dashboard Pages

#### Overview/Stats Page

**File:** `app/dashboard/page.tsx`

**Metrics to Display:**

- Total search requests (24h, 7d, 30d)
- Average response time
- Success/error rate
- Top queries
- Requests per hour (chart)
- Indexing status (last sync, success rate)
- Agents indexed count
- Rate limit hits

**Components:**

- `StatsCards.tsx` - Key metrics cards
- `RequestChart.tsx` - Time series chart
- `TopQueries.tsx` - Most common queries

#### Search Logs Page

**File:** `app/dashboard/search-logs/page.tsx`

**Features:**

- Table with pagination
- Filters: date range, status code, IP address, query text
- Sort by: timestamp, duration, response count
- Export to CSV
- View details modal (full query, filters, error message)

**Data from:** `request_logs` table

**Columns:**

- Timestamp
- IP Address
- Query (truncated)
- TopK
- Response Count
- Duration (ms)
- Status Code
- Error Message (if any)

#### Indexing Logs Page

**File:** `app/dashboard/indexing-logs/page.tsx`

**Features:**

- Table with pagination
- Filters: status, date range, chain ID
- View sync details (chains, agents indexed/deleted, batches)

**Data from:** `sync_logs` table

**Columns:**

- Started At
- Completed At
- Status
- Chains
- Agents Indexed
- Agents Deleted
- Batches Processed
- Duration
- Error Message (if any)

#### Whitelist Management Page

**File:** `app/dashboard/whitelist/page.tsx`

**Features:**

- List of whitelisted addresses
- Add new address (input + ENS resolution)
- Remove address
- Show when added and by whom
- Search/filter addresses

### 7. API Routes

#### Auth Routes

- `POST /api/auth/siwe/challenge` - Generate SIWE message
- `POST /api/auth/siwe/verify` - Verify signature and create session
- `GET /api/auth/session` - Check current session
- `POST /api/auth/logout` - Clear session

#### Admin Routes (Protected)

- `GET /api/admin/logs/search` - Get search logs with pagination/filters
- `GET /api/admin/logs/indexing` - Get indexing logs with pagination/filters
- `GET /api/admin/stats` - Get dashboard statistics
- `GET /api/admin/whitelist` - Get whitelist
- `POST /api/admin/whitelist` - Add address to whitelist
- `DELETE /api/admin/whitelist/:address` - Remove address

### 8. UI Components

**Required Components:**

- Login page with wallet connection
- Protected layout with logout
- Data tables with pagination
- Filter components
- Stats cards
- Charts (using recharts or similar)
- Loading states
- Error states

**Optional (shadcn/ui):**

- Button, Card, Table, Input, Select, Dialog
- Toast notifications
- Skeleton loaders

### 9. Environment Configuration

**`.env.local`:**

```
CLOUDFLARE_API_TOKEN=your_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
D1_DATABASE_ID=164eaaf0-6527-4e1b-b859-5805aae1b6c9
SIWE_DOMAIN=localhost:3000
SIWE_SECRET=your_jwt_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Database Queries

### Search Logs

```sql
-- Get recent search logs
SELECT * FROM request_logs 
ORDER BY timestamp DESC 
LIMIT ? OFFSET ?

-- Get stats
SELECT 
  COUNT(*) as total,
  AVG(duration_ms) as avg_duration,
  COUNT(CASE WHEN status_code = 200 THEN 1 END) as success_count,
  COUNT(CASE WHEN status_code != 200 THEN 1 END) as error_count
FROM request_logs
WHERE timestamp >= ?
```

### Indexing Logs

```sql
-- Get recent indexing logs
SELECT * FROM sync_logs
ORDER BY started_at DESC
LIMIT ? OFFSET ?

-- Get indexing stats
SELECT 
  COUNT(*) as total_syncs,
  COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
  SUM(agents_indexed) as total_indexed,
  SUM(agents_deleted) as total_deleted
FROM sync_logs
WHERE started_at >= ?
```

### Whitelist

```sql
-- Check if address is whitelisted
SELECT * FROM admin_whitelist WHERE wallet_address = LOWER(?)

-- Add to whitelist
INSERT INTO admin_whitelist (wallet_address, added_at, added_by)
VALUES (LOWER(?), ?, ?)

-- Remove from whitelist
DELETE FROM admin_whitelist WHERE wallet_address = LOWER(?)
```

## Security Considerations

1. **SIWE Verification:**

   - Verify signature on server
   - Check message domain matches
   - Verify nonce (prevent replay)
   - Check expiration

2. **Whitelist Check:**

   - Always check whitelist before creating session
   - Case-insensitive address comparison (lowercase)

3. **API Protection:**

   - All admin routes require valid session
   - Middleware checks JWT token
   - Rate limit admin endpoints

4. **D1 Access:**

   - Use read-only API token for queries (if possible)
   - Whitelist management requires write access
   - Sanitize all SQL inputs

## Files to Create

**New Directory:** `admin-dashboard/`

**Key Files:**

- `package.json` - Dependencies
- `next.config.js` - Next.js config
- `tailwind.config.js` - Tailwind config
- `tsconfig.json` - TypeScript config
- `lib/d1-client.ts` - D1 API client
- `lib/siwe.ts` - SIWE utilities
- `lib/auth.ts` - Session management
- `middleware.ts` - Route protection
- `app/layout.tsx` - Root layout
- `app/page.tsx` - Login page
- `app/dashboard/layout.tsx` - Protected layout
- `app/dashboard/page.tsx` - Overview/stats
- `app/dashboard/search-logs/page.tsx` - Search logs
- `app/dashboard/indexing-logs/page.tsx` - Indexing logs
- `app/dashboard/whitelist/page.tsx` - Whitelist management
- `app/api/auth/siwe/route.ts` - SIWE endpoints
- `app/api/auth/session/route.ts` - Session check
- `app/api/admin/logs/search/route.ts` - Search logs API
- `app/api/admin/logs/indexing/route.ts` - Indexing logs API
- `app/api/admin/stats/route.ts` - Stats API
- `app/api/admin/whitelist/route.ts` - Whitelist API
- `components/siwe/LoginButton.tsx` - Login component
- `components/dashboard/StatsCards.tsx` - Stats display
- `components/dashboard/SearchLogsTable.tsx` - Search logs table
- `components/dashboard/IndexingLogsTable.tsx` - Indexing logs table
- `components/dashboard/WhitelistManager.tsx` - Whitelist UI

**Migration (in search-service):**

- `migrations/0006_add_admin_whitelist.sql` - Whitelist table

## Testing Considerations

- Test SIWE flow end-to-end
- Test whitelist check (allowed/denied)
- Test session persistence
- Test protected routes (redirect if not authenticated)
- Test D1 queries (pagination, filters)
- Test whitelist management (add/remove)
- Test error handling (invalid signatures, expired sessions)

### To-dos

- [ ] Create new git branch for indexing feature
- [ ] Create D1 database migration with sync_state and indexing_config tables
- [ ] Implement D1SyncStateStore class implementing SemanticSyncStateStore interface
- [ ] Create config-store utility for reading/writing chains and cron timing from D1
- [ ] Create indexing service that initializes SDK and runs SemanticSyncRunner
- [ ] Create cron route handler that triggers indexing service
- [ ] Update main index.ts to register cron route
- [ ] Update wrangler.toml to enable D1 binding and cron triggers
- [ ] Update types.ts to make DB required in Env interface
- [ ] Verify agent0 SDK imports work correctly from agent0-ts repo