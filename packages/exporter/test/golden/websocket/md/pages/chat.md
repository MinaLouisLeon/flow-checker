# Page `/chat`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/chat/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`app/layout.tsx`) |
| Status | ✓ 1 verified |

## Component tree

- [`ChatPage`](../components/ChatPage.md) · server
  - [`Chat`](../components/Chat.md) · client · ⇄ 1 request

## Navigation

- From [`/`](index.md) (link)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET http://localhost:4011/socket.io/`](#req_1go4wbvvrlb) | effect | [`Chat`](../components/Chat.md) | ✓ verified (2 captures) |

### <a id="req_1go4wbvvrlb"></a>`GET http://localhost:4011/socket.io/`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`Chat`](../components/Chat.md) · `components/Chat.tsx:16` |
| Trigger | effect |
| Transport | websocket |
| URL | `http://localhost:4011/socket.io/` |
| Socket | socket.io |

**Receives `joined`** [`Joined`](../types.md#typ_1zt0n6v0ec6)

```ts
{ user: string; token: string }
```

**Receives `chat`** [`ChatMessage`](../types.md#typ_165m1q160hg)

```ts
{ id: number; user: string; text: string; at: number }
```

**Sends `chat`** [`Draft`](../types.md#typ_03lhxhb27lz)

```ts
{ text: string }
```

**Captured** `GET ws://localhost:4011/socket.io/?EIO=4&transport=websocket` → 101 · 243 ms · 2026-10-30 14:01 UTC · page `/chat` (newest of 2)

Messages: 3 sent and received, closed, close code 1005

```text
↓ joined: {"user":"ada","token":"[REDACTED:string]"}
↑ chat: {"text":"hello sockets"}
↓ chat: {"id":1,"user":"ada","text":"hello sockets","at":1793368902303}
```

Masked: `messages[0].body.token`
