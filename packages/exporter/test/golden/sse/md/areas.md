# Areas

[← Overview](README.md)

3 areas. Pages are grouped by the first static part of their URL (after route groups, dynamic segments and locales). Rename or merge them with the `areas` option in `flow-checker.config.ts`.

| Area | From | Pages | Components | Flows | Endpoints | Shared components | To check |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [home](#ar_1vn39fso9m3) | `/` | 1 | 2 | 0 | 1 | 1 | 0 |
| [chat](#ar_19t50bf2akw) | `/chat` | 1 | 2 | 1 | 1 | 1 | 0 |
| [jobs](#ar_0dcdhr9zs9y) | `/jobs` | 1 | 2 | 1 | 1 | 1 | 1 |

## <a id="ar_1vn39fso9m3"></a>home

|  |  |
| --- | --- |
| From | `/` |
| Pages | [`/`](pages/index.md) |
| Components | [`HomePage`](components/HomePage.md), [`Clock`](components/Clock.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Endpoints | [`GET /api/clock`](endpoints.md#ep_188dwjul88a) |

## <a id="ar_19t50bf2akw"></a>chat

|  |  |
| --- | --- |
| From | `/chat` |
| Pages | [`/chat`](pages/chat.md) |
| Components | [`ChatPage`](components/ChatPage.md), [`Chat`](components/Chat.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Flows | [Chat submit](flows/chat-submit.md) |
| Endpoints | [`POST /api/chat`](endpoints.md#ep_0fz0nz30uzo) |

## <a id="ar_0dcdhr9zs9y"></a>jobs

|  |  |
| --- | --- |
| From | `/jobs` |
| Pages | [`/jobs/[id]`](pages/jobs.%5Bid%5D.md) |
| Components | [`JobPage`](components/JobPage.md), [`JobProgress`](components/JobProgress.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Flows | [JobProgress click](flows/jobprogress-click.md) |
| Endpoints | [`GET /api/jobs/:id/progress`](endpoints.md#ep_2evc2sla3zo) |
| To check | [1 open note](issues.md) |

## Shared

Components used by more than half of the areas, and the requests only they send.

|  |  |
| --- | --- |
| Components | [`RootLayout`](components/RootLayout.md) |
