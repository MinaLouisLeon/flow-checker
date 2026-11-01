# Areas

[← Overview](README.md)

3 areas. Pages are grouped by the first static part of their URL (after route groups, dynamic segments and locales). Rename or merge them with the `areas` option in `flow-checker.config.ts`.

| Area | From | Pages | Components | Flows | Endpoints | Shared components | To check |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [home](#ar_1vn39fso9m3) | `/` | 1 | 4 | 1 | 3 | 2 | 0 |
| [search](#ar_1d3830wqgab) | `/search` | 1 | 2 | 1 | 1 | 2 | 0 |
| [todos](#ar_1zap1ick15k) | `/todos` | 1 | 2 | 1 | 2 | 2 | 0 |

## <a id="ar_1vn39fso9m3"></a>home

|  |  |
| --- | --- |
| From | `/` |
| Pages | [`/`](pages/index.md) |
| Components | [`HomePage`](components/HomePage.md), [`AddTodoForm`](components/AddTodoForm.md), [`TodoList`](components/TodoList.md), [`ViewerBadge`](components/ViewerBadge.md) |
| Shared components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
| Flows | [AddTodoForm submit](flows/addtodoform-submit.md) |
| Endpoints | [`mutation AddTodo`](endpoints.md#ep_1jutox0n6zl), [`query Todos`](endpoints.md#ep_2c5ny8u59q2), [`query Viewer`](endpoints.md#ep_1mvljeijms0) |

## <a id="ar_1d3830wqgab"></a>search

|  |  |
| --- | --- |
| From | `/search` |
| Pages | [`/search`](pages/search.md) |
| Components | [`SearchPage`](components/SearchPage.md), [`Search`](components/Search.md) |
| Shared components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
| Flows | [Search submit](flows/search-submit.md) |
| Endpoints | [`query Search`](endpoints.md#ep_2cve50sbne6) |

## <a id="ar_1zap1ick15k"></a>todos

|  |  |
| --- | --- |
| From | `/todos` |
| Pages | [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Components | [`TodoPage`](components/TodoPage.md), [`TodoDetail`](components/TodoDetail.md) |
| Shared components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
| Flows | [TodoDetail click](flows/tododetail-click.md) |
| Endpoints | [`query Todo`](endpoints.md#ep_2dska22im0v), [`mutation DeleteTodo`](endpoints.md#ep_1wr6ue0mqkn) |

## Shared

Components used by more than half of the areas, and the requests only they send.

|  |  |
| --- | --- |
| Components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
