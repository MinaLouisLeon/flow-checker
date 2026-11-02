# Areas

[← Overview](README.md)

2 areas. Pages are grouped by the first static part of their URL (after route groups, dynamic segments and locales). Rename or merge them with the `areas` option in `flow-checker.config.ts`.

| Area | From | Pages | Components | Flows | Endpoints | Shared components | To check |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [home](#ar_1vn39fso9m3) | `/` | 1 | 3 | 1 | 4 | 1 | 2 |
| [users](#ar_0tirr3qjab5) | `/users` | 1 | 2 | 1 | 2 | 1 | 1 |

## <a id="ar_1vn39fso9m3"></a>home

|  |  |
| --- | --- |
| From | `/` |
| Pages | [`/`](pages/index.md) |
| Components | [`HomePage`](components/HomePage.md), [`ProductPanel`](components/ProductPanel.md), [`TodoPanel`](components/TodoPanel.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Flows | [TodoPanel submit](flows/todopanel-submit.md) |
| Endpoints | [`GET /users`](endpoints.md#ep_16nzt1zcm62), [`GET /products`](endpoints.md#ep_1xk43u1zuzy), [`GET /todos`](endpoints.md#ep_26ggeb6bo31), [`POST /todos`](endpoints.md#ep_1tgnolqki2r) |
| To check | [2 open notes](issues.md) |

## <a id="ar_0tirr3qjab5"></a>users

|  |  |
| --- | --- |
| From | `/users` |
| Pages | [`/users/[id]`](pages/users.%5Bid%5D.md) |
| Components | [`UserPage`](components/UserPage.md), [`DeleteUserButton`](components/DeleteUserButton.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Flows | [DeleteUserButton click](flows/deleteuserbutton-click.md) |
| Endpoints | [`GET /users/:id`](endpoints.md#ep_1xqlxqpqvbv), [`DELETE /users/:id`](endpoints.md#ep_0l1jfzv9rl3) |
| To check | [1 open note](issues.md) |

## Shared

Components used by more than half of the areas, and the requests only they send.

|  |  |
| --- | --- |
| Components | [`RootLayout`](components/RootLayout.md) |
