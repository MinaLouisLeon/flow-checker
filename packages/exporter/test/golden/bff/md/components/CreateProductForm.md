# Component `CreateProductForm`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/CreateProductForm.tsx:8` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |

## Props

Takes no props.

## Types used

- [`ApiError`](../types.md#typ_2bhrdzxr8wt)
- [`CreateProductInput`](../types.md#typ_2g53pdr4pws)
- [`Product`](../types.md#typ_1rwhmsgdwtz)

## Navigation

- push `/products/:id` → [`/products/[id]`](../pages/products.%5Bid%5D.md) · event onSubmit · on success · `src/components/CreateProductForm.tsx:29`

## Flows

- [CreateProductForm submit](../flows/createproductform-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/products`](#req_2ckm3fl20ym) | event onSubmit | [`CreateProductForm`]() | ✓ verified (1 capture) |

### <a id="req_2ckm3fl20ym"></a>`POST /api/products`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`CreateProductForm`]() · `src/components/CreateProductForm.tsx:21` |
| Trigger | event onSubmit |
| Transport | fetch |
| URL | `/api/products` |
| Handled by | [`/api/products`](../pages/api.products.md) |

**Request body** [`CreateProductInput`](../types.md#typ_2g53pdr4pws)

```ts
{ name: string; price: number; stock?: number }
```

**Response** [`Product`](../types.md#typ_1rwhmsgdwtz)

```ts
{ id: number; name: string; price: number; stock: number }
```

**Captured** `POST http://localhost:3077/api/products` → 201 Created · 41 ms · 2026-10-28 10:57 UTC · page `/`

Request body:

```json
{
  "name": "Cable",
  "price": 9.5,
  "stock": 3
}
```

Response body:

```json
{
  "id": 3,
  "stock": 3,
  "name": "Cable",
  "price": 9.5
}
```

**Leads to** `POST {BACKEND_URL ?? http://localhost:4010}/products`:

#### <a id="req_02nrpzzew80"></a>`POST {BACKEND_URL ?? http://localhost:4010}/products`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | POST [`/api/products`](../pages/api.products.md) · `src/app/api/products/route.ts:23` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{BACKEND_URL ?? http://localhost:4010}/products` |
| Call path | `backend` → `fetch` |

**Request body** `{ name: string; price: number; stock: number; }`

```ts
{ name: string; price: number; stock: number }
```

**Response** [`Product`](../types.md#typ_1rwhmsgdwtz)

```ts
{ id: number; name: string; price: number; stock: number }
```

**Captured** `POST http://localhost:4010/products` → 201 Created · 8 ms · 2026-10-28 10:57 UTC

Request body:

```json
{
  "name": "Cable",
  "price": 9.5,
  "stock": 3
}
```

Response body:

```json
{
  "id": 3,
  "stock": 3,
  "name": "Cable",
  "price": 9.5
}
```
