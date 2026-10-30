# Component `Ticker`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `components/Ticker.tsx:10` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |

## Props

Takes no props.

## Types used

- [`Quote`](../types.md#typ_1kri650o74u)
- [`Subscribe`](../types.md#typ_01lxex28a31)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET ws://localhost:4011/live`](#req_0utndx9wfnl) | effect | [`Ticker`]() | ✗ type mismatch (2 captures) |

### <a id="req_0utndx9wfnl"></a>`GET ws://localhost:4011/live`

|  |  |
| --- | --- |
| Status | ✗ type mismatch (2 captures) |
| From | [`Ticker`]() · `components/Ticker.tsx:15` |
| Trigger | effect |
| Transport | websocket |
| URL | `ws://localhost:4011/live` |
| Socket | WebSocket · protocols `ticker.v1` |

> ⚠ **type-mismatch**: Received "message" doesn't match Quote: price is string "9.10" (expected number) (1 of 1 capture).

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
