# Areas

[← Overview](README.md)

2 areas. Pages are grouped by the first static part of their URL (after route groups, dynamic segments and locales). Rename or merge them with the `areas` option in `flow-checker.config.ts`.

| Area | From | Pages | Components | Flows | Endpoints | Shared components | To check |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [home](#ar_1vn39fso9m3) | `/` | 1 | 3 | 1 | 4 | 1 | 0 |
| [products](#ar_2erkuzrjb5u) | `/products` | 1 | 1 | 0 | 2 | 1 | 0 |

## <a id="ar_1vn39fso9m3"></a>home

|  |  |
| --- | --- |
| From | `/` |
| Pages | [`/`](pages/index.md) |
| Components | [`HomePage`](components/HomePage.md), [`CreateProductForm`](components/CreateProductForm.md), [`ProductsTable`](components/ProductsTable.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Flows | [CreateProductForm submit](flows/createproductform-submit.md) |
| Endpoints | [`GET /products`](endpoints.md#ep_1xle1no75i8), [`POST /products`](endpoints.md#ep_0z635a4otwk), [`POST /api/products`](endpoints.md#ep_1wed7wd3h3i), [`GET /api/products`](endpoints.md#ep_1eafh09thyg) |

## <a id="ar_2erkuzrjb5u"></a>products

|  |  |
| --- | --- |
| From | `/products` |
| Pages | [`/products/[id]`](pages/products.%5Bid%5D.md) |
| Components | [`ProductPage`](components/ProductPage.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Endpoints | [`GET /products/:id`](endpoints.md#ep_1rzjikzywsg), [`GET /api/products/:id`](endpoints.md#ep_21y4fdp2ksy) |

## Shared

Components used by more than half of the areas, and the requests only they send.

|  |  |
| --- | --- |
| Components | [`RootLayout`](components/RootLayout.md) |
