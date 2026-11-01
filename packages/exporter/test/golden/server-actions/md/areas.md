# Areas

[← Overview](README.md)

2 areas. Pages are grouped by the first static part of their URL (after route groups, dynamic segments and locales). Rename or merge them with the `areas` option in `flow-checker.config.ts`.

| Area | From | Pages | Components | Flows | Endpoints | Shared components | To check |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [home](#ar_1vn39fso9m3) | `/` | 1 | 1 | 0 | 0 | 1 | 0 |
| [products](#ar_2erkuzrjb5u) | `/products` | 3 | 5 | 2 | 6 | 1 | 0 |

## <a id="ar_1vn39fso9m3"></a>home

|  |  |
| --- | --- |
| From | `/` |
| Pages | [`/`](pages/index.md) |
| Components | [`Home`](components/Home.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |

## <a id="ar_2erkuzrjb5u"></a>products

|  |  |
| --- | --- |
| From | `/products` |
| Pages | [`/products`](pages/products.md), [`/products/[id]`](pages/products.%5Bid%5D.md), [`/products/new`](pages/products.new.md) |
| Components | [`ProductPage`](components/ProductPage.md), [`NewProductPage`](components/NewProductPage.md), [`ProductsPage`](components/ProductsPage.md), [`CreateProductForm`](components/CreateProductForm.md), [`DeleteProductButton`](components/DeleteProductButton.md) |
| Shared components | [`RootLayout`](components/RootLayout.md) |
| Flows | [CreateProductForm submit](flows/createproductform-submit.md), [DeleteProductButton click](flows/deleteproductbutton-click.md) |
| Endpoints | [`POST /products`](endpoints.md#ep_1b8rxbacsrz), [`DELETE /products/:id`](endpoints.md#ep_24zdsb1p2vt), [`GET /products/:id`](endpoints.md#ep_16zjeuqipey), [`GET /products`](endpoints.md#ep_16a5uohh2s8), [`action createProduct`](endpoints.md#ep_09hajlev2r5), [`action deleteProduct`](endpoints.md#ep_0ukrbhfpyjv) |

## Shared

Components used by more than half of the areas, and the requests only they send.

|  |  |
| --- | --- |
| Components | [`RootLayout`](components/RootLayout.md) |
