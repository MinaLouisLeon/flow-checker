# Areas

[← Overview](README.md)

6 areas. Pages are grouped by the first static part of their URL (after route groups, dynamic segments and locales). Rename or merge them with the `areas` option in `flow-checker.config.ts`.

| Area | From | Pages | Components | Flows | Endpoints | Shared components | To check |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [home](#ar_1vn39fso9m3) | `/` | 1 | 1 | 0 | 2 | 1 | 3 |
| [catalog](#ar_2buzu539ylk) | `/catalog` | 1 | 1 | 0 | 2 | 1 | 1 |
| [products](#ar_2erkuzrjb5u) | `/products` | 1 | 1 | 0 | 2 | 1 | 1 |
| [settings](#ar_1jfq6xl49zk) | `/settings` | 1 | 2 | 0 | 3 | 1 | 1 |
| [todos](#ar_1zap1ick15k) | `/todos` | 1 | 2 | 0 | 2 | 1 | 1 |
| [users](#ar_0tirr3qjab5) | `/users` | 1 | 1 | 0 | 3 | 1 | 1 |

## <a id="ar_1vn39fso9m3"></a>home

|  |  |
| --- | --- |
| From | `/` |
| Pages | [`/`](pages/index.md) |
| Components | [`Home`](components/Home.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Endpoints | [`GET /users/1`](endpoints.md#ep_1rapnh4g8ys), [`GET /products`](endpoints.md#ep_275iksa9pjl) |
| To check | [3 open notes](issues.md) |

## <a id="ar_2buzu539ylk"></a>catalog

|  |  |
| --- | --- |
| From | `/catalog` |
| Pages | [`/catalog`](pages/catalog.md) |
| Components | [`CatalogPage`](components/CatalogPage.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Endpoints | [`GET /products`](endpoints.md#ep_275iksa9pjl), [`GET /products/:id`](endpoints.md#ep_025t2a5t2lw) |
| To check | [1 open note](issues.md) |

## <a id="ar_2erkuzrjb5u"></a>products

|  |  |
| --- | --- |
| From | `/products` |
| Pages | [`/products`](pages/products.md) |
| Components | [`ProductsPage`](components/ProductsPage.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Endpoints | [`GET /products`](endpoints.md#ep_275iksa9pjl), [`GET /products/:id`](endpoints.md#ep_025t2a5t2lw) |
| To check | [1 open note](issues.md) |

## <a id="ar_1jfq6xl49zk"></a>settings

|  |  |
| --- | --- |
| From | `/settings` |
| Pages | [`/settings`](pages/settings.md) |
| Components | [`SettingsLayout`](components/SettingsLayout.md), [`SettingsPage`](components/SettingsPage.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Endpoints | [`GET /settings`](endpoints.md#ep_1ckvaf6myz5), [`GET /users/2`](endpoints.md#ep_28hbmhfa5x4), [`GET /users/1`](endpoints.md#ep_1rapnh4g8ys) |
| To check | [1 open note](issues.md) |

## <a id="ar_1zap1ick15k"></a>todos

|  |  |
| --- | --- |
| From | `/todos` |
| Pages | [`/todos`](pages/todos.md) |
| Components | [`TodosPage`](components/TodosPage.md), [`TodoRow`](components/TodoRow.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Endpoints | [`GET /todos`](endpoints.md#ep_26ggeb6bo31), [`GET /todos/:id`](endpoints.md#ep_1a2ydq3gya7) |
| To check | [1 open note](issues.md) |

## <a id="ar_0tirr3qjab5"></a>users

|  |  |
| --- | --- |
| From | `/users` |
| Pages | [`/users/[id]`](pages/users.%5Bid%5D.md) |
| Components | [`UserPage`](components/UserPage.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Endpoints | [`GET /users/:id`](endpoints.md#ep_0vl5nnfgzjj), [`GET /todos`](endpoints.md#ep_26ggeb6bo31), [`GET /products`](endpoints.md#ep_275iksa9pjl) |
| To check | [1 open note](issues.md) |

## Shared

Components used by more than half of the areas, and the requests only they send.

|  |  |
| --- | --- |
| Components | [`RootLayout`](components/RootLayout.md) |
