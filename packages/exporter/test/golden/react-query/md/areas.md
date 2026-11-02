# Areas

[← Overview](README.md)

4 areas. Pages are grouped by the first static part of their URL (after route groups, dynamic segments and locales). Rename or merge them with the `areas` option in `flow-checker.config.ts`.

| Area | From | Pages | Components | Flows | Endpoints | Shared components | To check |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [home](#ar_1vn39fso9m3) | `/` | 1 | 3 | 2 | 3 | 2 | 0 |
| [settings](#ar_1jfq6xl49zk) | `/settings` | 1 | 3 | 0 | 3 | 2 | 0 |
| [todos](#ar_1zap1ick15k) | `/todos` | 1 | 2 | 0 | 1 | 2 | 0 |
| [users](#ar_0tirr3qjab5) | `/users` | 1 | 2 | 2 | 3 | 2 | 0 |

## <a id="ar_1vn39fso9m3"></a>home

|  |  |
| --- | --- |
| From | `/` |
| Pages | [`/`](pages/index.md) |
| Components | [`TodosPage`](components/TodosPage.md), [`AddTodoForm`](components/AddTodoForm.md), [`TodoList`](components/TodoList.md) |
| Shared components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
| Flows | [AddTodoForm submit](flows/addtodoform-submit.md), [TodoList change](flows/todolist-change.md) |
| Endpoints | [`POST /todos`](endpoints.md#ep_1tgnolqki2r), [`GET /todos`](endpoints.md#ep_0i0im2g2p7v), [`PATCH /todos/:id`](endpoints.md#ep_04gtw68xyhb) |

## <a id="ar_1jfq6xl49zk"></a>settings

|  |  |
| --- | --- |
| From | `/settings` |
| Pages | [`/settings`](pages/settings.md) |
| Components | [`SettingsPage`](components/SettingsPage.md), [`SettingsBadge`](components/SettingsBadge.md), [`SettingsPanel`](components/SettingsPanel.md) |
| Shared components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
| Endpoints | [`GET /settings`](endpoints.md#ep_014n09i1jig), [`GET /users`](endpoints.md#ep_16nzt1zcm62), [`GET /todos`](endpoints.md#ep_0i0im2g2p7v) |

## <a id="ar_1zap1ick15k"></a>todos

|  |  |
| --- | --- |
| From | `/todos` |
| Pages | [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Components | [`TodoPage`](components/TodoPage.md), [`TodoDetail`](components/TodoDetail.md) |
| Shared components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
| Endpoints | [`GET /todos/:id`](endpoints.md#ep_1am9fi3i0v3) |

## <a id="ar_0tirr3qjab5"></a>users

|  |  |
| --- | --- |
| From | `/users` |
| Pages | [`/users`](pages/users.md) |
| Components | [`UsersPage`](components/UsersPage.md), [`UserList`](components/UserList.md) |
| Shared components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
| Flows | [UserList mouseenter](flows/userlist-mouseenter.md), [UserList click](flows/userlist-click.md) |
| Endpoints | [`GET /users`](endpoints.md#ep_16nzt1zcm62), [`GET /todos`](endpoints.md#ep_0i0im2g2p7v), [`GET /users/:id`](endpoints.md#ep_1xqlxqpqvbv) |

## Shared

Components used by more than half of the areas, and the requests only they send.

|  |  |
| --- | --- |
| Components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
