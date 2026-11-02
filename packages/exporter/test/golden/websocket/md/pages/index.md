# Page `/`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`app/layout.tsx`) |
| Access | open |
| Status | ✓ 1 verified, ✗ 1 mismatch |

## Component tree

- [`HomePage`](../components/HomePage.md) · server
  - [`Ticker`](../components/Ticker.md) · client · ⇄ 1 request
  - [`Ping`](../components/Ping.md) · client · ⇄ 1 request
  - `Link` · external (`next/link`)

## Navigation

- To [`/chat`](chat.md) (link)

## Flows

- [Ping click](../flows/ping-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET ws://localhost:4011/echo`](#req_1pacrdimeqg) | event onClick | [`Ping`](../components/Ping.md) | ✓ verified (1 capture) |
| [`GET ws://localhost:4011/live`](#req_0utndx9wfnl) | effect | [`Ticker`](../components/Ticker.md) | ✗ type mismatch (2 captures) |

### <a id="req_1pacrdimeqg"></a>`GET ws://localhost:4011/echo`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`Ping`](../components/Ping.md) · `components/Ping.tsx:11` |
| Trigger | event onClick |
| Transport | websocket |
| URL | `ws://localhost:4011/echo` |
| Socket | WebSocket |

**Sends `message`** `"ping"`

**Receives `message`**: no data type.

**Captured** `GET ws://localhost:4011/echo` → 101 · 7 ms · 2026-10-30 14:01 UTC · page `/`

Messages: 2 sent and received, closed, close code 1005

```text
↑ message: ping
↓ message: pong: ping
```

### <a id="req_0utndx9wfnl"></a>`GET ws://localhost:4011/live`

|  |  |
| --- | --- |
| Status | ✗ type mismatch (2 captures) |
| From | [`Ticker`](../components/Ticker.md) · `components/Ticker.tsx:15` |
| Trigger | effect |
| Transport | websocket |
| URL | `ws://localhost:4011/live` |
| Socket | WebSocket · protocols `ticker.v1` |

> ⚠ **[type-mismatch](../GLOSSARY.md#flag-type-mismatch)**: Received "message" doesn't match Quote: price is string "9.10" (expected number) (1 of 1 capture).

**Sends `message`** [`Subscribe`](../types.md#typ_01lxex28a31)

```ts
{ type: "subscribe"; symbols: string[] }
```

**Receives `message`** [`Quote`](../types.md#typ_1kri650o74u)

```ts
{ type: "quote"; symbol: string; price: number }
```

**Type check**: 1 of 1 checked capture didn't match.

| Part | Field | Problem | Expected | Captured | Captures |
| --- | --- | --- | --- | --- | ---: |
| received `message` | `price` | wrong-type | `number` | `string "9.10"` | 1 |

**Captured** `GET ws://localhost:4011/live` → 101 · 323 ms · 2026-10-30 14:01 UTC · page `/` (newest of 2)

Messages: 4 sent and received, closed, close code 1000

```text
↑ message: {"type":"subscribe","symbols":["ACME","BETA"]}
↓ message: {"type":"quote","symbol":"ACME","price":12.5}
↓ message: {"type":"quote","symbol":"ACME","price":12.75}
↓ message: {"type":"quote","symbol":"BETA","price":"9.10"}
```
