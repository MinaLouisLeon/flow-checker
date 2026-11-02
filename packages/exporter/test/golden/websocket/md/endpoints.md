# Endpoints

[← Overview](README.md)

3 endpoints on 1 host, 3 called from the browser. One endpoint is a method and URL pattern; tRPC procedures, GraphQL operations and server actions count one each. Requests to this app's own route handlers are listed under "This app's API", and what those handlers send on under the host it goes to.

## <a id="host-base_http___localhost_4011"></a>`http://localhost:4011`

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`GET /echo`](#ep_0qng4etwxjj) | WebSocket | browser | 1 | 1 | ✓ verified |
| [`GET /live`](#ep_1y3ipbn8uqn) | WebSocket | browser | 1 | 1 | ✗ type mismatch |
| [`GET /socket.io/`](#ep_1sdfh1pwpll) | WebSocket | browser | 1 | 1 | ✓ verified |

### <a id="ep_0qng4etwxjj"></a>`GET /echo`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | WebSocket |
| Called from | browser |
| Pages | [`/`](pages/index.md) |
| Call sites | [`GET ws://localhost:4011/echo`](components/Ping.md#req_1pacrdimeqg) in [`Ping`](components/Ping.md) |

**Captured** `GET ws://localhost:4011/echo` → 101 · 7 ms · 2026-10-30 14:01 UTC · page `/`

Messages: 2 sent and received, closed, close code 1005

```text
↑ message: ping
↓ message: pong: ping
```

### <a id="ep_1y3ipbn8uqn"></a>`GET /live`

|  |  |
| --- | --- |
| Status | ✗ type mismatch |
| Transport | WebSocket |
| Called from | browser |
| Pages | [`/`](pages/index.md) |
| Call sites | [`GET ws://localhost:4011/live`](components/Ticker.md#req_0utndx9wfnl) in [`Ticker`](components/Ticker.md) |

**Captured** `GET ws://localhost:4011/live` → 101 · 323 ms · 2026-10-30 14:01 UTC · page `/` (newest of 2)

Messages: 4 sent and received, closed, close code 1000

```text
↑ message: {"type":"subscribe","symbols":["ACME","BETA"]}
↓ message: {"type":"quote","symbol":"ACME","price":12.5}
↓ message: {"type":"quote","symbol":"ACME","price":12.75}
↓ message: {"type":"quote","symbol":"BETA","price":"9.10"}
```

### <a id="ep_1sdfh1pwpll"></a>`GET /socket.io/`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | WebSocket |
| Called from | browser |
| Pages | [`/chat`](pages/chat.md) |
| Call sites | [`GET http://localhost:4011/socket.io/`](components/Chat.md#req_1go4wbvvrlb) in [`Chat`](components/Chat.md) |

**Captured** `GET ws://localhost:4011/socket.io/?EIO=4&transport=websocket` → 101 · 243 ms · 2026-10-30 14:01 UTC · page `/chat` (newest of 2)

Messages: 3 sent and received, closed, close code 1005

```text
↓ joined: {"user":"ada","token":"[REDACTED:string]"}
↑ chat: {"text":"hello sockets"}
↓ chat: {"id":1,"user":"ada","text":"hello sockets","at":1793368902303}
```

Masked: `messages[0].body.token`
