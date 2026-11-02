# Page `/`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`app/layout.tsx`) |
| Access | open |
| Status | ✓ 1 verified |

## Component tree

- [`HomePage`](../components/HomePage.md) · server
  - [`Clock`](../components/Clock.md) · client · ⇄ 1 request
  - `Link` · external (`next/link`)

## Navigation

- To [`/jobs/[id]`](jobs.%5Bid%5D.md) (link)
- To [`/chat`](chat.md) (link)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET /api/clock?count=3`](#req_1iv9ud7bbfd) | effect | [`Clock`](../components/Clock.md) | ✓ verified (2 captures) |

### <a id="req_1iv9ud7bbfd"></a>`GET /api/clock?count=3`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`Clock`](../components/Clock.md) · `components/Clock.tsx:12` |
| Trigger | effect |
| Transport | sse |
| URL | `/api/clock?count=3` |
| Handled by | [`/api/clock`](api.clock.md) |
| Stream | EventSource |

**Event `tick`** [`Tick`](../types.md#typ_1e0lnxsqglq)

```ts
{ n: number; at: string }
```

**Event `message`** [`ClockStatus`](../types.md#typ_0hmmneuxlns)

```ts
{ state: "running" | "stopped"; ticks: number }
```

**Event `done`** (type from the route handler) `{ ok: boolean; }`

```ts
{ ok: boolean }
```

**Captured** `GET http://localhost:3077/api/clock?count=3` → 200 · 1045 ms · 2026-10-30 12:50 UTC · page `/` (newest of 2)

Messages: 5 received, closed

```text
tick: {"n":1,"at":"2026-10-30T12:50:17.269Z"}
tick: {"n":2,"at":"2026-10-30T12:50:17.480Z"}
tick: {"n":3,"at":"2026-10-30T12:50:17.683Z"}
message: {"state":"stopped","ticks":3}
done: {"ok":true}
```
