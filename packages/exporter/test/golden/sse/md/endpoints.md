# Endpoints

[← Overview](README.md)

3 endpoints on 1 host, 3 called from the browser. One endpoint is a method and URL pattern; tRPC procedures, GraphQL operations and server actions count one each. Requests to this app's own route handlers are listed under "This app's API", and what those handlers send on under the host it goes to.

## <a id="host-app"></a>This app's API

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`POST /api/chat`](#ep_0fz0nz30uzo) | event stream | browser | 1 | 1 | ✓ verified |
| [`GET /api/clock`](#ep_188dwjul88a) | event stream | browser | 1 | 1 | ✓ verified |
| [`GET /api/jobs/:id/progress`](#ep_2evc2sla3zo) | event stream | browser | 1 | 1 | ✗ type mismatch |

### <a id="ep_0fz0nz30uzo"></a>`POST /api/chat`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | event stream |
| Called from | browser |
| Served by | [`/api/chat`](pages/api.chat.md) |
| Pages | [`/chat`](pages/chat.md) |
| Call sites | [`POST /api/chat`](components/Chat.md#req_09bcv599usy) in [`Chat`](components/Chat.md) |

**Request body** [`ChatRequest`](types.md#typ_04sa5nuyyt9)

```ts
{ prompt: string }
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

### <a id="ep_188dwjul88a"></a>`GET /api/clock`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | event stream |
| Called from | browser |
| Served by | [`/api/clock`](pages/api.clock.md) |
| Query | `?count=3` |
| Pages | [`/`](pages/index.md) |
| Call sites | [`GET /api/clock?count=3`](components/Clock.md#req_1iv9ud7bbfd) in [`Clock`](components/Clock.md) |

**Captured** `GET http://localhost:3077/api/clock?count=3` → 200 · 1045 ms · 2026-10-30 12:50 UTC · page `/` (newest of 2)

Messages: 5 received, closed

```text
tick: {"n":1,"at":"2026-10-30T12:50:17.269Z"}
tick: {"n":2,"at":"2026-10-30T12:50:17.480Z"}
tick: {"n":3,"at":"2026-10-30T12:50:17.683Z"}
message: {"state":"stopped","ticks":3}
done: {"ok":true}
```

### <a id="ep_2evc2sla3zo"></a>`GET /api/jobs/:id/progress`

|  |  |
| --- | --- |
| Status | ✗ type mismatch |
| Transport | event stream |
| Called from | browser |
| Served by | [`/api/jobs/[id]/progress`](pages/api.jobs.%5Bid%5D.progress.md) |
| Pages | [`/jobs/[id]`](pages/jobs.%5Bid%5D.md) |
| Call sites | [`GET /api/jobs/:id/progress`](components/JobProgress.md#req_2efgv3zloxh) in [`JobProgress`](components/JobProgress.md) |

**Captured** `GET http://localhost:3077/api/jobs/7/progress` → 200 · 2349 ms · 2026-10-30 12:50 UTC · page `/jobs/7`

Messages: 5 received, closed

```text
progress: {"percent":"25%","step":"queued"}
progress: {"percent":"50%","step":"building"}
progress: {"percent":"75%","step":"testing"}
progress: {"percent":"100%","step":"deploying"}
done: {"id":"7","token":"[REDACTED:string]"}
```

Masked: `messages[4].body.token`
