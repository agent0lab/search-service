# AG0 Semantic Search Schema

# Agent Semantic Search API Schema (v1)

## Overview

This document defines the v1 search service schema (endpoints, request/response shapes, pagination, and error format) for semantic search over ERC-8004 agents.

**JSON Schema Support:** All endpoints include JSON Schema definitions for request and response validation. Providers should validate requests against the schema and may optionally expose schemas via `/v1/schemas/{endpoint}` endpoints.

## Base URL Structure

All endpoints should be prefixed with `/v{version}/`:

```
https://provider.example.com/api/v1/search
```

## Versioning

- **Path-based versioning**: `/v1/`, `/v2/`, etc.
- **Header-based versioning** (optional): `X-API-Version: 1`
- Clients should specify the version they support
- Providers must maintain backward compatibility within a major version

---

## Endpoints

### 1. Capabilities Discovery

**Endpoint:** `GET /api/v1/capabilities`

**Purpose:** Discover provider capabilities, limits, and supported features.

**Response:**

```json
{
  "version": "1.0.0",
  "limits": {
    "maxQueryLength": 1000,
    "maxLimit": 100,
    "maxFilters": 50,
    "maxRequestSize": 1048576
  },
  "supportedFilters": [
    "id",
    "cid",
    "agentId",
    "name",
    "description",
    "image",
    "active",
    "x402support",
    "supportedTrusts",
    "mcpEndpoint",
    "mcpVersion",
    "a2aEndpoint",
    "a2aVersion",
    "ens",
    "did",
    "agentWallet",
    "agentWalletChainId",
    "mcpTools",
    "mcpPrompts",
    "mcpResources",
    "a2aSkills",
    "chainId",
    "createdAt"
  ],
  "supportedOperators": [
    "equals",
    "in",
    "notIn",
    "exists",
    "notExists"
  ],
  "features": {
    "pagination": true,
    "cursorPagination": true,
    "metadataFiltering": true,
    "scoreThreshold": true
  }
}
```

**JSON Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "version": { "type": "string" },
    "limits": {
      "type": "object",
      "properties": {
        "maxQueryLength": { "type": "integer", "minimum": 1 },
        "maxLimit": { "type": "integer", "minimum": 1 },
        "maxFilters": { "type": "integer", "minimum": 0 },
        "maxRequestSize": { "type": "integer", "minimum": 1 }
      },
      "required": ["maxQueryLength", "maxLimit"]
    },
    "supportedFilters": {
      "type": "array",
      "items": { "type": "string" }
    },
    "supportedOperators": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["equals", "in", "notIn", "range", "exists", "notExists"]
      }
    },
    "features": {
      "type": "object",
      "properties": {
        "pagination": { "type": "boolean" },
        "cursorPagination": { "type": "boolean" },
        "metadataFiltering": { "type": "boolean" },
        "scoreThreshold": { "type": "boolean" }
      }
    }
  },
  "required": ["version", "limits", "supportedFilters", "supportedOperators", "features"]
}
```

**Status Codes:**

- `200 OK` - Capabilities returned successfully

---

### 2. Health Check

**Endpoint:** `GET /api/v1/health`

**Purpose:** Check service health and availability.

**Response:**

```json
{
  "status": "ok" | "degraded" | "down",
  "timestamp": "2025-12-01T00:00:00.000Z",
  "version": "1.0.0",
  "services": {
    "embedding": "ok" | "error",
    "vectorStore": "ok" | "error"
  },
  "uptime": 3600
}
```

**Status Codes:**

- `200 OK` - Service is healthy
- `503 Service Unavailable` - Service is degraded or down

---

### 3. Search

**Endpoint:** `POST /api/v1/search`

**Purpose:** Perform semantic search query.

**Headers:**

```
Content-Type: application/json
Accept: application/json
X-API-Version: 1 (optional)
X-Request-ID: uuid (optional, for request tracing)
```

**Request Body:**

```json
{
  "query": "string (required)",
  "limit": 10,
  "offset": 0,
  "cursor": "string (optional, for cursor-based pagination)",
  "filters": {
    "equals": {
      "agentId": "11155111:123",
      "active": true,
      "x402support": false,
      "ens": "agent.eth"
    },
    "in": {
      "chainId": [11155111, 84532],
      "supportedTrusts": ["reputation", "crypto-economic"],
      "mcpTools": ["code_generation", "analysis"],
      "a2aSkills": ["python", "javascript"],
      "mcpPrompts": ["code_review"],
      "mcpResources": ["documentation"]
    },
    "notIn": {
      "chainId": [80002]
    },
    "exists": [
      "mcpEndpoint",
      "a2aEndpoint",
      "agentURI",
      "image"
    ],
    "notExists": [
      "deprecated"
    ]
  },
  "minScore": 0.0,
  "includeMetadata": true
}
```

**Request Fields:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `query` | string | Yes | Natural language search query. Used for semantic similarity matching. |
| `limit` | number | No | Maximum number of results to return (default: 10, max: see capabilities.maxLimit). |
| `offset` | number | No | Offset for pagination (default: 0). Only used with offset-based pagination. |
| `cursor` | string | No | Cursor for cursor-based pagination. When provided, takes precedence over `offset`. |
| `filters` | object | No | Filter criteria (see Filter Schema below). Filters are applied after semantic search but before pagination. |
| `minScore` | number | No | Minimum similarity score threshold (0.0-1.0). Results with scores below this threshold are excluded. |
| `includeMetadata` | boolean | No | Include full metadata in response (default: true). If false, only essential fields are returned. |

**Response Headers:**

```
X-Request-ID: uuid
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
Content-Type: application/json
```

**Response Body:**

```json
{
  "query": "string",
  "results": [
    {
      "rank": 1,
      "vectorId": "string",
      "agentId": "string",
      "chainId": 11155111,
      "name": "string",
      "description": "string",
      "score": 0.95,
      "metadata": {
        "id": "transactionHash:cid",
        "cid": "Qm...",
        "image": "https://example.com/image.png",
        "active": true,
        "x402support": true,
        "supportedTrusts": ["reputation", "crypto-economic"],
        "mcpEndpoint": "https://example.com/mcp",
        "mcpVersion": "1.0.0",
        "a2aEndpoint": "https://example.com/a2a",
        "a2aVersion": "1.0.0",
        "ens": "agent.eth",
        "did": "did:ethr:0x...",
        "agentWallet": "0x...",
        "agentWalletChainId": 11155111,
        "mcpTools": ["code_generation", "analysis"],
        "mcpPrompts": ["code_review"],
        "mcpResources": ["documentation"],
        "a2aSkills": ["python", "javascript"],
        "agentURI": "ipfs://...",
        "createdAt": 1704067200
      },
      "matchReasons": [
        "Excellent semantic match",
        "Capabilities: defi, trading"
      ]
    }
  ],
  "total": 42,
  "pagination": {
    "hasMore": true,
    "nextCursor": "string",
    "limit": 10,
    "offset": 0
  },
  "requestId": "uuid",
  "timestamp": "2025-12-01T00:00:00.000Z",
  "provider": {
    "name": "string",
    "version": "string"
  }
}
```

**Response Fields:**

| Field | Type | Description |
| --- | --- | --- |
| `query` | string | Echo of the search query that was executed |
| `results` | array | Array of search results, ordered by relevance score (highest first) |
| `total` | number | Total number of results available (may be approximate for large result sets) |
| `pagination` | object | Pagination metadata (if applicable) |
| `requestId` | string | Unique request identifier (matches X-Request-ID header if provided) |
| `timestamp` | string | ISO 8601 timestamp of when the response was generated |
| `provider` | object | Provider metadata (name and version) |

**Result Object:**

| Field | Type | Description |
| --- | --- | --- |
| `rank` | number | Result rank (1-indexed, where 1 is the most relevant result) |
| `vectorId` | string | Unique vector identifier in the vector store |
| `agentId` | string | Agent identifier in format "chainId:tokenId" (e.g., "11155111:123") |
| `chainId` | number | Blockchain network ID (e.g., 11155111 for Ethereum Sepolia) |
| `name` | string | Agent name from registration |
| `description` | string | Agent description from registration |
| `score` | number | Similarity score (0.0-1.0, where 1.0 is perfect match) |
| `metadata` | object | Additional metadata (see Metadata Schema below) |
| `matchReasons` | array | Array of strings explaining why this result matched (helpful for debugging) |

**Status Codes:**

- `200 OK` - Search completed successfully
- `400 Bad Request` - Invalid request (see Error Response)
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Service temporarily unavailable

---

## Filter Schema

Filters support both common operators and domain-specific filters based on the `AgentRegistrationFile` schema.

### Common operators

**equals:** Exact match for a single value

```json
{
  "filters": {
    "equals": {
      "agentId": "11155111:123",
      "active": true,
      "x402support": false,
      "ens": "agent.eth",
      "mcpVersion": "1.0.0"
    }
  }
}
```

**in:** Match any value in array (OR logic)

```json
{
  "filters": {
    "in": {
      "chainId": [11155111, 84532],
      "supportedTrusts": ["reputation", "crypto-economic"],
      "mcpTools": ["code_generation", "analysis"],
      "a2aSkills": ["python", "javascript"]
    }
  }
}
```

**notIn:** Exclude values in array

```json
{
  "filters": {
    "notIn": {
      "chainId": [80002],
      "supportedTrusts": ["tee-attestation"]
    }
  }
}
```

**exists:** Field must exist (not null/undefined)

```json
{
  "filters": {
    "exists": [
      "mcpEndpoint",
      "a2aEndpoint",
      "agentURI",
      "image",
      "ens",
      "did"
    ]
  }
}
```

**notExists:** Field must not exist

```json
{
  "filters": {
    "notExists": [
      "deprecated",
      "deleted"
    ]
  }
}
```

### Domain-Specific Filters (AgentRegistrationFile Fields)

All filters correspond to fields in the `AgentRegistrationFile` GraphQL type:

| Filter Field | Type | Description | Example |
| --- | --- | --- | --- |
| `id` | string | Registration file ID (format: "transactionHash:cid") | `"0x123...:Qm..."` |
| `cid` | string | IPFS CID | `"QmXyZ..."` |
| `agentId` | string | Agent ID (format: "chainId:tokenId") | `"11155111:123"` |
| `name` | string | Agent name | `"Trading Bot"` |
| `description` | string | Agent description | `"AI agent for DeFi trading"` |
| `image` | string | Agent image URL | `"https://..."` |
| `active` | boolean | Whether agent is active | `true` |
| `x402support` | boolean | Whether agent supports ERC-402 payments | `true` |
| `supportedTrusts` | string[] | Array of supported trust models | `["reputation", "crypto-economic"]` |
| `mcpEndpoint` | string | MCP endpoint URL | `"https://..."` |
| `mcpVersion` | string | MCP protocol version | `"1.0.0"` |
| `a2aEndpoint` | string | A2A endpoint URL | `"https://..."` |
| `a2aVersion` | string | A2A protocol version | `"1.0.0"` |
| `ens` | string | ENS domain name | `"agent.eth"` |
| `did` | string | Decentralized identifier | `"did:ethr:0x..."` |
| `agentWallet` | string | Agent wallet address (hex) | `"0x..."` |
| `agentWalletChainId` | number | Chain ID for agent wallet | `11155111` |
| `mcpTools` | string[] | Array of MCP tool names | `["code_generation", "analysis"]` |
| `mcpPrompts` | string[] | Array of MCP prompt names | `["code_review"]` |
| `mcpResources` | string[] | Array of MCP resource names | `["documentation"]` |
| `a2aSkills` | string[] | Array of A2A skill names | `["python", "javascript"]` |
| `chainId` | number | Blockchain network ID | `11155111` |
| `createdAt` | number | Registration timestamp (Unix epoch) | `1704067200` |

**Example Combined Filters:**

```json
{
  "filters": {
    "equals": {
      "active": true,
      "x402support": true
    },
    "in": {
      "chainId": [11155111, 84532],
      "supportedTrusts": ["reputation"],
      "mcpTools": ["code_generation"],
      "a2aSkills": ["python"]
    },
    "exists": ["mcpEndpoint", "agentURI"]
  }
}
```

**Note:** Providers may support additional filters beyond those listed. Check `/api/v1/capabilities` for the complete list of supported filters.

---

## Metadata Schema

Common metadata fields for search results, matching `AgentRegistrationFile`:

```json
{
  "metadata": {
    "id": "transactionHash:cid",
    "cid": "QmXyZ...",
    "image": "https://example.com/image.png",
    "active": true,
    "x402support": true,
    "supportedTrusts": ["reputation", "crypto-economic"],
    "mcpEndpoint": "https://example.com/mcp",
    "mcpVersion": "1.0.0",
    "a2aEndpoint": "https://example.com/a2a",
    "a2aVersion": "1.0.0",
    "ens": "agent.eth",
    "did": "did:ethr:0x...",
    "agentWallet": "0x...",
    "agentWalletChainId": 11155111,
    "mcpTools": ["code_generation", "analysis"],
    "mcpPrompts": ["code_review"],
    "mcpResources": ["documentation"],
    "a2aSkills": ["python", "javascript"],
    "agentURI": "ipfs://...",
    "createdAt": 1704067200
  }
}
```

**Metadata Fields:**

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Registration file ID (format: "transactionHash:cid") |
| `cid` | string | IPFS CID for the registration file |
| `image` | string | Agent image URL |
| `active` | boolean | Whether the agent is currently active |
| `x402support` | boolean | Whether the agent supports ERC-402 payments |
| `supportedTrusts` | string[] | Array of supported trust models |
| `mcpEndpoint` | string | MCP endpoint URL (if available) |
| `mcpVersion` | string | MCP protocol version |
| `a2aEndpoint` | string | A2A endpoint URL (if available) |
| `a2aVersion` | string | A2A protocol version |
| `ens` | string | ENS domain name (if registered) |
| `did` | string | Decentralized identifier |
| `agentWallet` | string | Agent wallet address (hex format) |
| `agentWalletChainId` | number | Chain ID where the agent wallet is deployed |
| `mcpTools` | string[] | Array of MCP tool identifiers |
| `mcpPrompts` | string[] | Array of MCP prompt identifiers |
| `mcpResources` | string[] | Array of MCP resource identifiers |
| `a2aSkills` | string[] | Array of A2A skill identifiers |
| `agentURI` | string | Agent URI (typically IPFS) |
| `createdAt` | number | Registration timestamp (Unix epoch seconds) |

Providers may include additional metadata fields. Clients should handle unknown fields gracefully.

---

## JSON Schema Endpoints (Optional)

Providers may optionally expose JSON schemas for validation:

**Endpoint:** `GET /api/v1/schemas/{endpoint}`

**Examples:**

- `GET /api/v1/schemas/search` - Schema for search request/response
- `GET /api/v1/schemas/capabilities` - Schema for capabilities response
- `GET /api/v1/schemas/health` - Schema for health response

**Response:**

```json
{
  "request": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "query": { "type": "string", "minLength": 1 },
      "limit": { "type": "integer", "minimum": 1, "maximum": 100 },
      "topK": { "type": "integer", "minimum": 1, "maximum": 100 },
      "filters": { "$ref": "#/definitions/filters" }
    },
    "required": ["query"]
  },
  "response": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "results": { "type": "array", "items": { "$ref": "#/definitions/result" } },
      "total": { "type": "integer" }
    },
    "required": ["query", "results", "total"]
  }
}
```

---

## Error Response

All errors follow a consistent format:

```json
{
  "error": "string",
  "code": "VALIDATION_ERROR" | "RATE_LIMIT_EXCEEDED" | "INTERNAL_ERROR" | "BAD_REQUEST" | "NOT_FOUND",
  "status": 400,
  "requestId": "uuid",
  "timestamp": "2025-12-01T00:00:00.000Z"
}
```

**Error Codes:**

| Code | HTTP Status | Description |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Request validation failed (e.g., invalid JSON, missing required fields, value out of range) |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `BAD_REQUEST` | 400 | Malformed request |
| `NOT_FOUND` | 404 | Resource not found |

**Error Response Headers:**

```
X-Request-ID: uuid
Retry-After: 60 (for 429 errors)
```

---

## Rate Limiting

Rate limits are communicated via response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

When rate limit is exceeded:

- Status: `429 Too Many Requests`
- Header: `Retry-After: 60` (seconds until retry)
- Body: error response with `RATE_LIMIT_EXCEEDED` code

---

## Pagination

Two pagination methods are supported:

### Offset-based Pagination

```json
{
  "limit": 10,
  "offset": 0
}
```

Response includes:

```json
{
  "pagination": {
    "hasMore": true,
    "limit": 10,
    "offset": 0
  }
}
```

### Cursor-based Pagination (Preferred)

Cursor format is **SDK-compatible**:

- `cursor` and `nextCursor` are **decimal string offsets** (e.g., `"0"`, `"10"`, `"25"`), representing the number of items already returned.
- Providers MAY additionally accept a raw JSON string cursor containing `"_global_offset"` for multi-chain pagination, but the recommended portable format is the decimal string offset.

```json
{
  "limit": 10,
  "cursor": "10"
}
```

Response includes:

```json
{
  "pagination": {
    "hasMore": true,
    "nextCursor": "20",
    "limit": 10
  }
}
```

**Note:** Providers may support one or both methods. Check `/api/v1/capabilities` for supported pagination types. When both `cursor` and `offset` are provided, `cursor` takes precedence.

---

## Request Tracing

Clients may include a request ID for tracing:

**Request Header:**

```
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
```

**Response Header:**

```
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
```

**Response Body:**

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "...": "..."
}
```

If no request ID is provided, the provider should generate one.

---

## Content Negotiation

**Request Headers:**

```
Content-Type: application/json
Accept: application/json
Accept-Version: v1 (optional)
```

**Response Headers:**

```
Content-Type: application/json
```

Only JSON is currently supported. Future versions may support additional formats.

---

## Security

### CORS

Providers should support CORS for browser-based clients:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-API-Version, X-Request-ID
```

### Security Headers

Providers should include common security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

### Authentication

Authentication is provider-specific and not part of this schema. Providers may require:

- API keys in headers: `Authorization: Bearer <token>`
- API keys in query: `?apiKey=<key>`
- OAuth2 tokens
- Other authentication methods

Check provider documentation for authentication requirements.

---

## Implementation Checklist

For an implementation to be compliant with this schema:

- [ ]  Implement `/api/v1/capabilities` endpoint
- [ ]  Implement `/api/v1/health` endpoint
- [ ]  Implement `/api/v1/search` endpoint
- [ ]  Support versioning in URL path
- [ ]  Return standardized error responses
- [ ]  Include rate limit headers in responses
- [ ]  Support request ID tracing
- [ ]  Support at least one pagination method
- [ ]  Include provider metadata in responses
- [ ]  Support the common filter operators
- [ ]  Support AgentRegistrationFile filter fields
- [ ]  Return standardized metadata schema
- [ ]  Include security headers
- [ ]  Support CORS
- [ ]  (Optional) Expose JSON schemas via `/v1/schemas/*`
- [ ]  (Optional) Validate requests against JSON schemas

---

## Example Usage

### Basic Search

```bash
curl -X POST https://provider.example.com/api/v1/search \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: $(uuidgen)" \
  -d '{
    "query": "AI agent for trading",
    "limit": 10
  }'
```

### Search with Filters

```bash
curl -X POST https://provider.example.com/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "defi agent",
    "limit": 5,
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
  }'
```

### Paginated Search

```bash
curl -X POST https://provider.example.com/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "portfolio management",
    "limit": 20,
    "cursor": "20"
  }'
```

### Check Capabilities

```bash
curl https://provider.example.com/api/v1/capabilities
```

### Health Check

```bash
curl https://provider.example.com/api/v1/health
```

### Get JSON Schema (Optional)

```bash
curl https://provider.example.com/api/v1/schemas/search
```

---

## Version History

- **v1.0.0** (2025-12-01) - Initial schema specification

---

## License

This schema is provided as-is for interoperability purposes. Implementations may extend it with provider-specific features while maintaining backward compatibility.

