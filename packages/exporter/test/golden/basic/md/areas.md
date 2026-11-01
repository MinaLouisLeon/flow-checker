# Areas

[← Overview](README.md)

3 areas. Pages are grouped by the first static part of their URL (after route groups, dynamic segments and locales). Rename or merge them with the `areas` option in `flow-checker.config.ts`.

| Area | From | Pages | Components | Flows | Endpoints | Shared components | To check |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [home](#ar_1vn39fso9m3) | `/` | 1 | 2 | 0 | 1 | 1 | 0 |
| [about](#ar_1twt91jehoj) | `/about` | 1 | 1 | 0 | 0 | 1 | 0 |
| [users](#ar_0tirr3qjab5) | `/users` | 1 | 3 | 1 | 3 | 1 | 0 |

## <a id="ar_1vn39fso9m3"></a>home

|  |  |
| --- | --- |
| From | `/` |
| Pages | [`/`](pages/index.md) |
| Components | [`HomePage`](components/HomePage.md), [`UserList`](components/UserList.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Endpoints | [`GET /users`](endpoints.md#ep_16nzt1zcm62) |

## <a id="ar_1twt91jehoj"></a>about

|  |  |
| --- | --- |
| From | `/about` |
| Pages | [`/about`](pages/about.md) |
| Components | [`AboutPage`](components/AboutPage.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |

## <a id="ar_0tirr3qjab5"></a>users

|  |  |
| --- | --- |
| From | `/users` |
| Pages | [`/users/[id]`](pages/users.%5Bid%5D.md) |
| Components | [`UserPage`](components/UserPage.md), [`DeleteUserButton`](components/DeleteUserButton.md), [`ProfileCard`](components/ProfileCard.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Flows | [DeleteUserButton click](flows/deleteuserbutton-click.md) |
| Endpoints | [`GET /users/:id`](endpoints.md#ep_1xqlxqpqvbv), [`DELETE /users/:id`](endpoints.md#ep_0l1jfzv9rl3), [`GET /todos`](endpoints.md#ep_0i0im2g2p7v) |

## Shared

Components used by more than half of the areas, and the requests only they send.

|  |  |
| --- | --- |
| Components | [`RootLayout`](components/RootLayout.md) |
