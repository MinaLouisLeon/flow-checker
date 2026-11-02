# Areas

[← Overview](README.md)

3 areas. Pages are grouped by the first static part of their URL (after route groups, dynamic segments and locales). Rename or merge them with the `areas` option in `flow-checker.config.ts`.

| Area | From | Pages | Components | Flows | Endpoints | Shared components | To check |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [home](#ar_1vn39fso9m3) | `/` | 1 | 5 | 1 | 9 | 2 | 0 |
| [feed](#ar_005q5nhjyp9) | `/feed` | 1 | 2 | 0 | 4 | 2 | 0 |
| [todos](#ar_1zap1ick15k) | `/todos` | 1 | 2 | 1 | 7 | 2 | 0 |

## <a id="ar_1vn39fso9m3"></a>home

|  |  |
| --- | --- |
| From | `/` |
| Pages | [`/`](pages/index.md) |
| Components | [`HomePage`](components/HomePage.md), [`AddTodoForm`](components/AddTodoForm.md), [`HealthBadge`](components/HealthBadge.md), [`TodoList`](components/TodoList.md), [`UserList`](components/UserList.md) |
| Shared components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
| Flows | [AddTodoForm submit](flows/addtodoform-submit.md) |
| Endpoints | [`POST todo.add`](endpoints.md#ep_0ibv7krl4ej), [`GET ping`](endpoints.md#ep_05b4rvdf69k), [`GET todo.list`](endpoints.md#ep_0msu49db75v), [`GET user.list`](endpoints.md#ep_1rinmezu3ej), [`GET /todos`](endpoints.md#ep_25v9o6f1xuc), [`GET /todos/:id`](endpoints.md#ep_2byawmgpkxh), [`POST /todos`](endpoints.md#ep_1a9zvb2cvpx), [`PATCH /todos/:id`](endpoints.md#ep_06drh6l9g5j), [`GET /users`](endpoints.md#ep_1ummwnixxxj) |

## <a id="ar_005q5nhjyp9"></a>feed

|  |  |
| --- | --- |
| From | `/feed` |
| Pages | [`/feed`](pages/feed.md) |
| Components | [`FeedPage`](components/FeedPage.md), [`TodoFeed`](components/TodoFeed.md) |
| Shared components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
| Endpoints | [`GET todo.feed`](endpoints.md#ep_0dfumbyiny9), [`GET /todos`](endpoints.md#ep_25v9o6f1xuc), [`GET /todos/:id`](endpoints.md#ep_2byawmgpkxh), [`GET /users`](endpoints.md#ep_1ummwnixxxj) |

## <a id="ar_1zap1ick15k"></a>todos

|  |  |
| --- | --- |
| From | `/todos` |
| Pages | [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Components | [`TodoPage`](components/TodoPage.md), [`TodoDetail`](components/TodoDetail.md) |
| Shared components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
| Flows | [TodoDetail click](flows/tododetail-click.md) |
| Endpoints | [`GET todo.byId`](endpoints.md#ep_25303l9f52p), [`POST todo.toggle`](endpoints.md#ep_1u7mfef31ll), [`GET /todos`](endpoints.md#ep_25v9o6f1xuc), [`GET /todos/:id`](endpoints.md#ep_2byawmgpkxh), [`POST /todos`](endpoints.md#ep_1a9zvb2cvpx), [`PATCH /todos/:id`](endpoints.md#ep_06drh6l9g5j), [`GET /users`](endpoints.md#ep_1ummwnixxxj) |

## Shared

Components used by more than half of the areas, and the requests only they send.

|  |  |
| --- | --- |
| Components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
