# Page `/feed`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/feed/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | open |
| Status | ✓ 1 verified |

## Component tree

- [`FeedPage`](../components/FeedPage.md) · server
  - [`TodoFeed`](../components/TodoFeed.md) · client · ⇄ 1 request

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET /api/trpc/todo.feed`](#req_1c78i0tgtyn) | page-load | [`TodoFeed`](../components/TodoFeed.md) | ✓ verified (2 captures) |

### <a id="req_1c78i0tgtyn"></a>`GET /api/trpc/todo.feed`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodoFeed`](../components/TodoFeed.md) · `src/components/TodoFeed.tsx:6` |
| Trigger | page-load |
| Transport | trpc · `useInfiniteQuery` |
| URL | `/api/trpc/todo.feed` |
| tRPC | [`todo.feed`](../trpc.md#procedure-todo_feed) (query) |
| Handled by | [`/api/trpc/[trpc]`](api.trpc.%5Btrpc%5D.md) |

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
| From | GET [`/api/trpc/[trpc]`](api.trpc.%5Btrpc%5D.md) · `src/server/routers/todo.ts:27` |
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
