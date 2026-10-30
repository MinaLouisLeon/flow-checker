# Route handler `/api/jobs/[id]/progress`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/api/jobs/[id]/progress/route.ts` |
| Methods | GET |

## Event stream (GET)

| Event | Data | Where |
| --- | --- | --- |
| `progress` | `{ percent: string; step: string; }` | `app/api/jobs/[id]/progress/route.ts:14` |
| `done` | `{ id: string; token: string; }` | `app/api/jobs/[id]/progress/route.ts:17` |

**`progress`** `{ percent: string; step: string; }`

```ts
{ percent: string; step: string }
```

**`done`** `{ id: string; token: string; }`

```ts
{ id: string; token: string }
```

## Called by

| Request | From | Status |
| --- | --- | --- |
| [`GET /api/jobs/:id/progress`](../components/JobProgress.md#req_2efgv3zloxh) | [`JobProgress`](../components/JobProgress.md) | ✗ type mismatch (1 capture) |

## Requests it sends

None found.
