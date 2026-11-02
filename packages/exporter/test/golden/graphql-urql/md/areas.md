# Areas

[← Overview](README.md)

3 areas. Pages are grouped by the first static part of their URL (after route groups, dynamic segments and locales). Rename or merge them with the `areas` option in `flow-checker.config.ts`.

| Area | From | Pages | Components | Flows | Endpoints | Shared components | To check |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [home](#ar_1vn39fso9m3) | `/` | 1 | 3 | 1 | 2 | 2 | 0 |
| [todos](#ar_1zap1ick15k) | `/todos` | 1 | 2 | 1 | 2 | 2 | 0 |
| [users](#ar_0tirr3qjab5) | `/users` | 1 | 2 | 1 | 1 | 2 | 0 |

## <a id="ar_1vn39fso9m3"></a>home

|  |  |
| --- | --- |
| From | `/` |
| Pages | [`/`](pages/index.md) |
| Components | [`HomePage`](components/HomePage.md), [`AddTodoForm`](components/AddTodoForm.md), [`TodoList`](components/TodoList.md) |
| Shared components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
| Flows | [AddTodoForm submit](flows/addtodoform-submit.md) |
| Endpoints | [`mutation AddTodo`](endpoints.md#ep_1jutox0n6zl), [`query Todos`](endpoints.md#ep_2c5ny8u59q2) |

## <a id="ar_1zap1ick15k"></a>todos

|  |  |
| --- | --- |
| From | `/todos` |
| Pages | [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Components | [`TodoPage`](components/TodoPage.md), [`TodoDetail`](components/TodoDetail.md) |
| Shared components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
| Flows | [TodoDetail click](flows/tododetail-click.md) |
| Endpoints | [`query Todo`](endpoints.md#ep_2dska22im0v), [`mutation ToggleTodo`](endpoints.md#ep_0dra48drhl8) |

## <a id="ar_0tirr3qjab5"></a>users

|  |  |
| --- | --- |
| From | `/users` |
| Pages | [`/users`](pages/users.md) |
| Components | [`UsersPage`](components/UsersPage.md), [`UserList`](components/UserList.md) |
| Shared components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
| Flows | [UserList click](flows/userlist-click.md) |
| Endpoints | [`query Users`](endpoints.md#ep_2fwm7w18i75) |

## Shared

Components used by more than half of the areas, and the requests only they send.

|  |  |
| --- | --- |
| Components | [`RootLayout`](components/RootLayout.md), [`Providers`](components/Providers.md) |
