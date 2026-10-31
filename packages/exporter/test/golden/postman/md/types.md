# Types

[← Overview](README.md)

4 named types, fully resolved.

## <a id="typ_2ao02lpx6nv"></a>User

interface · `types/index.ts:1`

```ts
interface User { id: number; name: string; email: string; role: "admin" | "member" }
```

Used by: request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](components/HomePage.md#req_0iv5kcsl9up).

## <a id="typ_1f1vojxmn7g"></a>Product

interface · `types/index.ts:8`

```ts
interface Product { id: number; name: string; price: string; stock: number }
```

Used by: used in [`ProductPanel`](components/ProductPanel.md), request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/products`](components/ProductPanel.md#req_08kv7zxxjyg).

## <a id="typ_29n1iw0u1hd"></a>Todo

interface · `types/index.ts:16`

```ts
interface Todo { id: number; userId: number; title: string; done: boolean }
```

Used by: used in [`TodoPanel`](components/TodoPanel.md), request [`GET http://localhost:4010/todos`](components/TodoPanel.md#req_1e93pbv41le), request [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/TodoPanel.md#req_07zzxwzir2w).

## <a id="typ_1hvhy5iwv7p"></a>NewTodo

interface · `types/index.ts:23`

```ts
interface NewTodo { title: string; userId: number }
```

Used by: request [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/TodoPanel.md#req_07zzxwzir2w).
