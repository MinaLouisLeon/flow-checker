# Types

[← Overview](README.md)

4 named types, fully resolved.

## <a id="typ_0mxt2h8i81o"></a>User

interface · `src/lib/types.ts:1`

```ts
interface User { id: number; name: string; email: string; role: string }
```

Used by: request [`GET http://localhost:4010/users/1?delay=80`](components/Home.md#req_23ca0tetmxk), request [`GET http://localhost:4010/users/2?delay=80`](components/SettingsLayout.md#req_1rc36qnaspk), request [`GET http://localhost:4010/users/1?delay=20`](components/SettingsLayout.md#req_03bknq0ncj5), request [`GET http://localhost:4010/users/2?delay=80`](components/SettingsPage.md#req_1lhn3mfgf8g), request [`GET http://localhost:4010/users/1?delay=20`](components/SettingsPage.md#req_0vimi2c2ovq), request [`GET http://localhost:4010/users/:id?delay=80`](components/UserPage.md#req_1n4wecz1zex), request [`GET http://localhost:4010/users/:id?delay=80`](components/UserPage.md#req_228s24jz87h).

## <a id="typ_0v98ajm1yyv"></a>Product

interface · `src/lib/types.ts:8`

```ts
interface Product { id: number; name: string; price: number; stock: number }
```

Used by: used in [`ProductsPage`](components/ProductsPage.md), request [`GET http://localhost:4010/products?delay=80`](components/CatalogPage.md#req_1nrjkflsk7s), request [`GET http://localhost:4010/products/:id?delay=40`](components/CatalogPage.md#req_07e7tpm2bap), request [`GET http://localhost:4010/products?delay=80`](components/Home.md#req_0kd0ltojnrd), request [`GET http://localhost:4010/products?delay=80`](components/ProductsPage.md#req_14b37uscwxs), request [`GET http://localhost:4010/products/:id?delay=40`](components/ProductsPage.md#req_16g2mworngz), request [`GET http://localhost:4010/products?delay=80`](components/UserPage.md#req_21fpvnjjwok).

## <a id="typ_25zdvnqvuxl"></a>Todo

interface · `src/lib/types.ts:15`

```ts
interface Todo { id: number; userId: number; title: string; done: boolean }
```

Used by: used in [`TodoRow`](components/TodoRow.md), request [`GET http://localhost:4010/todos?delay=40`](components/TodosPage.md#req_14km2kuqtgu), request [`GET http://localhost:4010/todos?userId=:userId&delay=40`](components/UserPage.md#req_00405rt0lsa), request [`GET http://localhost:4010/todos/:id?delay=30`](components/TodoRow.md#req_21cujfajgmg).

## <a id="typ_0vz15qy2iug"></a>Settings

interface · `src/lib/types.ts:22`

```ts
interface Settings { theme: string; locale: string; digest: string | null }
```

Used by: request [`GET http://localhost:4010/settings?delay=40`](components/SettingsLayout.md#req_147qy0vyz3e), request [`GET http://localhost:4010/settings?delay=40`](components/SettingsPage.md#req_1p429pabq9j).
