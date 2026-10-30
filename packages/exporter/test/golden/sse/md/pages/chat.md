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

## Flows

- [Chat submit](../flows/chat-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/chat`](#req_09bcv599usy) | event onSubmit | [`Chat`](../components/Chat.md) | ✓ verified (1 capture) |

### <a id="req_09bcv599usy"></a>`POST /api/chat`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`Chat`](../components/Chat.md) · `components/Chat.tsx:15` |
| Trigger | event onSubmit |
| Transport | sse |
| URL | `/api/chat` |
| Handled by | [`/api/chat`](api.chat.md) |
| Stream | streamed fetch |
| Call path | `streamChat` → `fetch` |

**Request body** [`ChatRequest`](../types.md#typ_04sa5nuyyt9)

```ts
{ prompt: string }
```

**Event `chunk`** (type from the route handler) [`ChatChunk`](../types.md#typ_0xbzrh9hnrs)

```ts
{ delta: string }
```

**Event `done`** (type from the route handler) [`ChatDone`](../types.md#typ_18qlraimf3z)

```ts
{ tokens: number }
```

**Captured** `POST http://localhost:3077/api/chat` → 200 OK · 483 ms · 2026-10-30 12:50 UTC · page `/chat`

Request body:

```json
{
  "prompt": "hello there"
}
```

Messages: 5 received, closed

```text
chunk: {"delta":"You "}
chunk: {"delta":"said: "}
chunk: {"delta":"hello "}
chunk: {"delta":"there "}
done: {"tokens":4}
```
