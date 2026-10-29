# Types

[← Overview](README.md)

3 named types, fully resolved.

## <a id="typ_1rwhmsgdwtz"></a>Product

type-alias · `src/lib/schemas.ts:15`

```ts
type Product = { id: number; name: string; price: number; stock: number }
```

Used by: used in [`ProductPage`](components/ProductPage.md), used in [`CreateProductForm`](components/CreateProductForm.md), used in [`ProductsTable`](components/ProductsTable.md), request [`GET {BACKEND_URL ?? http://localhost:4010}/products/:id`](pages/api.products.%5Bid%5D.md#req_1t6ibh8o0so), request [`GET {BACKEND_URL ?? http://localhost:4010}/products`](pages/api.products.md#req_0pmni454dyo), request [`POST {BACKEND_URL ?? http://localhost:4010}/products`](pages/api.products.md#req_02nrpzzew80), request [`GET /api/products/:id`](components/ProductPage.md#req_2c3yq1l5klb), request [`POST /api/products`](components/CreateProductForm.md#req_2ckm3fl20ym), request [`GET /api/products`](components/ProductsTable.md#req_1vj2qrt6hdx).

## <a id="typ_2g53pdr4pws"></a>CreateProductInput

type-alias · `src/lib/schemas.ts:16`

```ts
type CreateProductInput = { name: string; price: number; stock?: number }
```

Used by: used in [`CreateProductForm`](components/CreateProductForm.md), request [`POST /api/products`](components/CreateProductForm.md#req_2ckm3fl20ym).

## <a id="typ_2bhrdzxr8wt"></a>ApiError

interface · `src/lib/schemas.ts:18`

```ts
interface ApiError { error: string; issues?: { path: string; message: string }[] }
```

Used by: used in [`CreateProductForm`](components/CreateProductForm.md).
