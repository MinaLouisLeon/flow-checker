# Areas

[← Overview](README.md)

4 areas. Pages are grouped by the first static part of their URL (after route groups, dynamic segments and locales). Rename or merge them with the `areas` option in `flow-checker.config.ts`.

| Area | From | Pages | Components | Flows | Endpoints | Shared components | To check |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [home](#ar_1vn39fso9m3) | `/` | 1 | 1 | 0 | 0 | 1 | 0 |
| [dashboard](#ar_1q9mt49i536) | `/dashboard` | 2 | 2 | 0 | 2 | 1 | 0 |
| [login](#ar_0pgtfiopjqa) | `/login` | 1 | 1 | 0 | 0 | 1 | 0 |
| [products](#ar_2erkuzrjb5u) | `/products` | 1 | 1 | 0 | 1 | 1 | 0 |

## <a id="ar_1vn39fso9m3"></a>home

|  |  |
| --- | --- |
| From | `/` |
| Pages | [`/`](pages/index.md) |
| Components | [`HomePage`](components/HomePage.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |

## <a id="ar_1q9mt49i536"></a>dashboard

|  |  |
| --- | --- |
| From | `/dashboard` |
| Pages | [`/dashboard`](pages/dashboard.md), [`/dashboard/settings`](pages/dashboard.settings.md) |
| Components | [`DashboardPage`](components/DashboardPage.md), [`SettingsPage`](components/SettingsPage.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Endpoints | [`GET /users`](endpoints.md#ep_1ummwnixxxj), [`GET /settings`](endpoints.md#ep_0hbwt9tdbrl) |

## <a id="ar_0pgtfiopjqa"></a>login

|  |  |
| --- | --- |
| From | `/login` |
| Pages | [`/login`](pages/login.md) |
| Components | [`LoginPage`](components/LoginPage.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |

## <a id="ar_2erkuzrjb5u"></a>products

|  |  |
| --- | --- |
| From | `/products` |
| Pages | [`/products`](pages/products.md) |
| Components | [`ProductsPage`](components/ProductsPage.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Endpoints | [`GET /products`](endpoints.md#ep_16a5uohh2s8) |

## Shared

Components used by more than half of the areas, and the requests only they send.

|  |  |
| --- | --- |
| Components | [`RootLayout`](components/RootLayout.md) |
