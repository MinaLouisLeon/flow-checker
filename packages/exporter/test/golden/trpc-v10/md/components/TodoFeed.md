# Component `TodoFeed`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/TodoFeed.tsx:5` |
| Kind | client (`'use client'`) |
| Used on | [`/feed`](../pages/feed.md) |
| Rendered by | [`FeedPage`](FeedPage.md) |

## Props

Takes no props.

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET /api/trpc/todo.feed`](#req_1c78i0tgtyn) | page-load | [`TodoFeed`]() | ✓ verified (2 captures) |

### <a id="req_1c78i0tgtyn"></a>`GET /api/trpc/todo.feed`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodoFeed`]() · `src/components/TodoFeed.tsx:6` |
| Trigger | page-load |
| Transport | trpc · `useInfiniteQuery` |
| URL | `/api/trpc/todo.feed` |
| tRPC | [`todo.feed`](../trpc.md#procedure-todo_feed) (query) |
| Handled by | [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) |

**Request body** `{ limit: number; cursor?: number | null }`

**Response** [`TodoPage`](../types.md#typ_1ztzqbb553r)

```ts
{ items: Todo[]; nextCursor: number | null }
```

**Captured** `GET http://localhost:3077/api/trpc/todo.feed` → 200 · 37 ms · 2026-10-30 07:05 UTC · page `/feed` (newest of 2)

Request body:

```json
{
  "limit": 1,
  "cursor": 1
}
```

Response body:

```json
{
  "items": [
    {
      "id": 2,
      "userId": 2,
      "title": "Break Enigma",
      "done": false
    }
  ],
  "nextCursor": 2
}
```

**Leads to** `GET {API_URL ?? http://localhost:4010}/todos`:

#### <a id="req_2flmlyku854"></a>`GET {API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | GET [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) · `src/server/routers/todo.ts:27` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/todos` |
| In procedure | [`todo.feed`](../trpc.md#procedure-todo_feed) (query) |
| Call path | `listTodos` → `api` → `fetch` |

**Response** `Todo[]` (see [`Todo`](../types.md#typ_0fc96ucq8sd))

**Captured** `GET http://localhost:4010/todos` → 200 OK · 3 ms · 2026-10-30 07:05 UTC (newest of 2)

Response body:

```json
[
  {
    "id": 1,
    "userId": 1,
    "title": "Write the first program",
    "done": true
  },
  {
    "id": 2,
    "userId": 2,
    "title": "Break Enigma",
    "done": false
  },
  {
    "id": 3,
    "userId": 1,
    "done": true,
    "title": "Record captures"
  }
]
```
