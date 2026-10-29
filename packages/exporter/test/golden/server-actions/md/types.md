# Types

[← Overview](README.md)

3 named types, fully resolved.

## <a id="typ_0c608pp860k"></a>Product

interface · `src/types/product.ts:1`

```ts
interface Product { id: number; name: string; price: number; stock: number }
```

Used by: request [`POST {API_URL ?? http://localhost:4010}/products`](components/CreateProductForm.md#req_0h59cmicyii), request [`GET {API_URL ?? http://localhost:4010}/products/:id`](components/ProductPage.md#req_25a1hdpohd6), request [`GET {API_URL ?? http://localhost:4010}/products`](components/ProductsPage.md#req_1u9qpywsqwd).

## <a id="typ_1ft4f009hfw"></a>CreateProductInput

type-alias · `src/types/product.ts:8`

```ts
type CreateProductInput = { name: string; price: number; stock: number }
```

Used by: request [`POST {API_URL ?? http://localhost:4010}/products`](components/CreateProductForm.md#req_0h59cmicyii).

## <a id="typ_1a49e9mbomv"></a>FormState

interface · `src/types/product.ts:10`

```ts
interface FormState {
  error?: string
  fieldErrors?: { name?: string; price?: string; stock?: string }
}
```

Used by: request [`POST createProduct (server action)`](components/CreateProductForm.md#req_07o63rveyo8).
