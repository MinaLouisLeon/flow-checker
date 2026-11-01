# Areas

[← Overview](README.md)

3 areas. Pages are grouped by the first static part of their URL (after route groups, dynamic segments and locales). Rename or merge them with the `areas` option in `flow-checker.config.ts`.

| Area | From | Pages | Components | Flows | Endpoints | Shared components | To check |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [home](#ar_1vn39fso9m3) | `/` | 1 | 4 | 1 | 9 | 2 | 2 |
| [todos](#ar_1zap1ick15k) | `/todos` | 1 | 2 | 1 | 9 | 2 | 2 |
| [users](#ar_0tirr3qjab5) | `/users` | 1 | 2 | 0 | 5 | 2 | 2 |

## <a id="ar_1vn39fso9m3"></a>home

|  |  |
| --- | --- |
| From | `/` |
| Pages | [`/`](pages/index.md) |
| Components | [`HomePage`](components/HomePage.md), [`AddTodoForm`](components/AddTodoForm.md), [`HealthBadge`](components/HealthBadge.md), [`TodoList`](components/TodoList.md) |
| Shared components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
| Flows | [AddTodoForm submit](flows/addtodoform-submit.md) |
| Endpoints | [`POST todo.add`](endpoints.md#ep_0ibv7krl4ej), [`GET health.ping`](endpoints.md#ep_02nhwic4gly), [`GET todo.list`](endpoints.md#ep_0msu49db75v), [`GET /todos`](endpoints.md#ep_25v9o6f1xuc), [`GET /todos/:id`](endpoints.md#ep_2byawmgpkxh), [`POST /todos`](endpoints.md#ep_1a9zvb2cvpx), [`PATCH /todos/:id`](endpoints.md#ep_06drh6l9g5j), [`GET /users`](endpoints.md#ep_1ummwnixxxj), [`GET /users/:id`](endpoints.md#ep_0o9nq5wpp19) |
| To check | [2 open notes](issues.md) |

## <a id="ar_1zap1ick15k"></a>todos

|  |  |
| --- | --- |
| From | `/todos` |
| Pages | [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Components | [`TodoPage`](components/TodoPage.md), [`TodoDetail`](components/TodoDetail.md) |
| Shared components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
| Flows | [TodoDetail click](flows/tododetail-click.md) |
| Endpoints | [`GET todo.byId`](endpoints.md#ep_25303l9f52p), [`GET user.byId`](endpoints.md#ep_07ze9d1keja), [`POST todo.toggle`](endpoints.md#ep_1u7mfef31ll), [`GET /todos`](endpoints.md#ep_25v9o6f1xuc), [`GET /todos/:id`](endpoints.md#ep_2byawmgpkxh), [`POST /todos`](endpoints.md#ep_1a9zvb2cvpx), [`PATCH /todos/:id`](endpoints.md#ep_06drh6l9g5j), [`GET /users`](endpoints.md#ep_1ummwnixxxj), [`GET /users/:id`](endpoints.md#ep_0o9nq5wpp19) |
| To check | [2 open notes](issues.md) |

## <a id="ar_0tirr3qjab5"></a>users

|  |  |
| --- | --- |
| From | `/users` |
| Pages | [`/users`](pages/users.md) |
| Components | [`UsersPage`](components/UsersPage.md), [`UserList`](components/UserList.md) |
| Shared components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
| Endpoints | [`GET user.list`](endpoints.md#ep_1rinmezu3ej), [`GET /todos`](endpoints.md#ep_25v9o6f1xuc), [`GET /todos/:id`](endpoints.md#ep_2byawmgpkxh), [`GET /users`](endpoints.md#ep_1ummwnixxxj), [`GET /users/:id`](endpoints.md#ep_0o9nq5wpp19) |
| To check | [2 open notes](issues.md) |

## Shared

Components used by more than half of the areas, and the requests only they send.

|  |  |
| --- | --- |
| Components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
