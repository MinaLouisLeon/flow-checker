# Route handler `/api/chat`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/api/chat/route.ts` |
| Methods | POST |

## Event stream (POST)

| Event | Data | Where |
| --- | --- | --- |
| `chunk` | `ChatChunk` | `app/api/chat/route.ts:14` |
| `done` | `ChatDone` | `app/api/chat/route.ts:18` |

**`chunk`** [`ChatChunk`](../types.md#typ_0xbzrh9hnrs)

```ts
{ delta: string }
```

**`done`** [`ChatDone`](../types.md#typ_18qlraimf3z)

```ts
{ tokens: number }
```

## Called by

| Request | From | Status |
| --- | --- | --- |
| [`POST /api/chat`](../components/Chat.md#req_09bcv599usy) | [`Chat`](../components/Chat.md) | ✓ verified (1 capture) |

## Requests it sends

None found.
