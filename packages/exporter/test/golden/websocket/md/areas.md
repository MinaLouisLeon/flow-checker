# Areas

[← Overview](README.md)

2 areas. Pages are grouped by the first static part of their URL (after route groups, dynamic segments and locales). Rename or merge them with the `areas` option in `flow-checker.config.ts`.

| Area | From | Pages | Components | Flows | Endpoints | Shared components | To check |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [home](#ar_1vn39fso9m3) | `/` | 1 | 3 | 1 | 2 | 1 | 1 |
| [chat](#ar_19t50bf2akw) | `/chat` | 1 | 2 | 0 | 1 | 1 | 0 |

## <a id="ar_1vn39fso9m3"></a>home

|  |  |
| --- | --- |
| From | `/` |
| Pages | [`/`](pages/index.md) |
| Components | [`HomePage`](components/HomePage.md), [`Ping`](components/Ping.md), [`Ticker`](components/Ticker.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Flows | [Ping click](flows/ping-click.md) |
| Endpoints | [`GET /echo`](endpoints.md#ep_0qng4etwxjj), [`GET /live`](endpoints.md#ep_1y3ipbn8uqn) |
| To check | [1 open note](issues.md) |

## <a id="ar_19t50bf2akw"></a>chat

|  |  |
| --- | --- |
| From | `/chat` |
| Pages | [`/chat`](pages/chat.md) |
| Components | [`ChatPage`](components/ChatPage.md), [`Chat`](components/Chat.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Endpoints | [`GET /socket.io/`](endpoints.md#ep_1sdfh1pwpll) |

## Shared

Components used by more than half of the areas, and the requests only they send.

|  |  |
| --- | --- |
| Components | [`RootLayout`](components/RootLayout.md) |
