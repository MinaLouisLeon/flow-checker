# Component `Ping`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `components/Ping.tsx:7` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |

## Props

Takes no props.

## Flows

- [Ping click](../flows/ping-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET ws://localhost:4011/echo`](#req_1pacrdimeqg) | event onClick | [`Ping`]() | ✓ verified (1 capture) |

### <a id="req_1pacrdimeqg"></a>`GET ws://localhost:4011/echo`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`Ping`]() · `components/Ping.tsx:11` |
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
