# Types

[← Overview](README.md)

3 named types, fully resolved.

## <a id="typ_0857a9l1j3p"></a>User

interface · `types/user.ts:1`

```ts
interface User { id: number; name: string; email: string; role: "admin" | "member" }
```

Used by: request [`GET {API_URL ?? http://localhost:4010}/users`](components/DashboardPage.md#req_02gshaf9oil), request [`GET {API_URL ?? http://localhost:4010}/me`](middleware.md#req_0pdaq2dj6vz).

## <a id="typ_21gfaviyj48"></a>Settings

interface · `types/user.ts:8`

```ts
interface Settings { theme: string; locale: string; digest: string | null }
```

Used by: request [`GET {API_URL ?? http://localhost:4010}/settings`](components/SettingsPage.md#req_0q6t9lmdld7).

## <a id="typ_2dct2hpocpn"></a>Product

interface · `types/user.ts:14`

```ts
interface Product { id: number; name: string; price: number; stock: number }
```

Used by: request [`GET {API_URL ?? http://localhost:4010}/products`](components/ProductsPage.md#req_263u38ocrza).
