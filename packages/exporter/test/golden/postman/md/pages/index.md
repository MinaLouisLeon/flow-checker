# Page `/`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`app/layout.tsx`) |
| Access | open |
| Status | ✓ 3 verified, ✗ 1 mismatch |

## Component tree

- [`HomePage`](../components/HomePage.md) · server · ⇄ 1 request
  - `Link` · external (`next/link`)
  - [`ProductPanel`](../components/ProductPanel.md) · client · ⇄ 1 request
  - [`TodoPanel`](../components/TodoPanel.md) · client · ⇄ 2 requests

## Navigation

- To [`/users/[id]`](users.%5Bid%5D.md) (link)
- From [`/users/[id]`](users.%5Bid%5D.md) (push)

## Flows

- [DeleteUserButton click](../flows/deleteuserbutton-click.md)
- [TodoPanel submit](../flows/todopanel-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](#req_0iv5kcsl9up) | server-render | [`HomePage`](../components/HomePage.md) | ✓ verified (3 captures) |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/products`](#req_08kv7zxxjyg) | effect | [`ProductPanel`](../components/ProductPanel.md) | ✗ type mismatch (4 captures) |
| [`GET http://localhost:4010/todos`](#req_1e93pbv41le) | effect | [`TodoPanel`](../components/TodoPanel.md) | ✓ verified (4 captures) |
| [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](#req_07zzxwzir2w) | event onSubmit | [`TodoPanel`](../components/TodoPanel.md) | ✓ verified (1 capture) |

### <a id="req_0iv5kcsl9up"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`

|  |  |
| --- | --- |
| Status | ✓ verified (3 captures) |
| From | [`HomePage`](../components/HomePage.md) · `app/page.tsx:10` |
| Trigger | server-render |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users` |
| Postman | [List users](../postman.md#pmr_0juh4djhx8l) |
| Call path | `getUsers` → `fetch` |

**Response** `User[]` (see [`User`](../types.md#typ_2ao02lpx6nv))

**Captured** `GET http://localhost:4010/users` → 200 OK · 8 ms · 2026-10-30 04:06 UTC (newest of 3)

Response body:

```json
[
  {
    "id": 1,
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "role": "admin"
  }
]
```

### <a id="req_08kv7zxxjyg"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/products`

|  |  |
| --- | --- |
| Status | ✗ type mismatch (4 captures) |
| From | [`ProductPanel`](../components/ProductPanel.md) · `components/ProductPanel.tsx:11` |
| Trigger | effect |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/products` |
| Postman | [List products](../postman.md#pmr_266pqs2sv5q) |
| Call path | `getProducts` → `fetch` |

> ⚠ **[contract-mismatch](../GLOSSARY.md#flag-contract-mismatch)**: The response type Product\[\] doesn't match the Postman example "200 OK": \[\].price is number 49.9 (expected string).
>
> ⚠ **[type-mismatch](../GLOSSARY.md#flag-type-mismatch)**: Response doesn't match Product\[\]: \[\].price is number 49.9 (expected string) (4 of 4 captures).

**Response** `Product[]` (see [`Product`](../types.md#typ_1f1vojxmn7g))

**Type check**: 4 of 4 checked captures didn't match.

| Part | Field | Problem | Expected | Captured | Captures |
| --- | --- | --- | --- | --- | ---: |
| response | `[].price` | wrong-type | `string` | `number 49.9` | 4 |

**Captured** `GET http://localhost:4010/products` → 200 OK · 5 ms · 2026-10-30 04:06 UTC · page `/` (newest of 4)

Response body:

```json
[
  {
    "id": 1,
    "name": "Keyboard",
    "price": 49.9,
    "stock": 12
  },
  {
    "id": 2,
    "name": "Mouse",
    "price": 19.5,
    "stock": 0
  }
]
```

### <a id="req_1e93pbv41le"></a>`GET http://localhost:4010/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (4 captures) |
| From | [`TodoPanel`](../components/TodoPanel.md) · `components/TodoPanel.tsx:12` |
| Trigger | effect |
| Transport | fetch |
| URL | `http://localhost:4010/todos` (from Postman) |
| Postman | [List todos](../postman.md#pmr_1786nvyhcbb) · matched by name and method, URL from the collection |
| Call path | `listTodos` → `fetch` |

**Response** `Todo[]` (see [`Todo`](../types.md#typ_29n1iw0u1hd))

**Captured** `GET http://localhost:4010/todos` → 200 OK · 6 ms · 2026-10-30 04:06 UTC · page `/` (newest of 4)

Response body:

```json
[
  {
    "id": 1,
    "userId": 1,
    "title": "Write the first program",
    "done": true
  },
  {
    "id": 2,
    "userId": 2,
    "title": "Break Enigma",
    "done": false
  },
  {
    "id": 3,
    "userId": 1,
    "done": false,
    "title": "Check the contract"
  }
]
```

### <a id="req_07zzxwzir2w"></a>`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoPanel`](../components/TodoPanel.md) · `components/TodoPanel.tsx:18` |
| Trigger | event onSubmit |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos` |
| Postman | [Create todo](../postman.md#pmr_1jsi4tlr1i9) |
| Call path | `createTodo` → `fetch` |

**Request body** [`NewTodo`](../types.md#typ_1hvhy5iwv7p)

```ts
{ title: string; userId: number }
```

**Response** [`Todo`](../types.md#typ_29n1iw0u1hd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:4010/todos` → 201 Created · 6 ms · 2026-10-30 04:06 UTC · page `/`

Request body:

```json
{
  "title": "Check the contract",
  "userId": 1
}
```

Response body:

```json
{
  "id": 3,
  "userId": 1,
  "done": false,
  "title": "Check the contract"
}
```
