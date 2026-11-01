# Postman collection: Fixture API

[← Overview](README.md)

|  |  |
| --- | --- |
| Collection | Fixture API · collection folder `postman/collections/Fixture API` |
| Environment | Local · file `postman/environments/local.yaml` |
| Imported | 2026-10-29 12:00 UTC |
| Summary | 5 of 7 requests called by the app, 2 unused endpoints, 1 request in the code not in the collection, 1 contract mismatch |

The collection is the API contract: each request in the code is matched to a collection request by method and URL, or by its names and method when the scan could not resolve the URL. Types marked "from Postman examples" come from the saved responses, not the code.

## Requests

### Users

#### <a id="pmr_0juh4djhx8l"></a>List users

|  |  |
| --- | --- |
| Request | `GET {{baseUrl}}/users` |
| URL | `http://localhost:4010/users` |
| Called by | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](components/HomePage.md#req_0iv5kcsl9up) in [`HomePage`](components/HomePage.md) |
| Examples | 200 OK |

**Response** (from the examples) `{ id: number; name: string; email: string; role: string }[]`

#### <a id="pmr_0kyh3rt9c3n"></a>Get user

|  |  |
| --- | --- |
| Request | `GET {{baseUrl}}/users/:id` |
| URL | `http://localhost:4010/users/:id` |
| Called by | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](components/UserPage.md#req_0zfyatg6d3b) in [`UserPage`](components/UserPage.md) |
| Examples | 200 OK, 404 Not Found |

**Response** (from the examples) `{ id: number; name: string; email: string; role: string }`

### Products

#### <a id="pmr_266pqs2sv5q"></a>List products

|  |  |
| --- | --- |
| Request | `GET {{baseUrl}}/products` |
| URL | `http://localhost:4010/products` |
| Called by | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/products`](components/ProductPanel.md#req_08kv7zxxjyg) in [`ProductPanel`](components/ProductPanel.md) |
| Examples | 200 OK |

**Response** (from the examples) `{ id: number; name: string; price: number; stock: number }[]`

#### <a id="pmr_072ggar1q9m"></a>Delete product

|  |  |
| --- | --- |
| Request | `DELETE {{baseUrl}}/products/:id` |
| URL | `http://localhost:4010/products/:id` |
| Called by | nothing in the code |

> ⚠ **[unused-endpoint](GLOSSARY.md#flag-unused-endpoint)**: No request in the code calls this endpoint.

### Todos

#### <a id="pmr_1786nvyhcbb"></a>List todos

|  |  |
| --- | --- |
| Request | `GET {{baseUrl}}/todos` |
| URL | `http://localhost:4010/todos` |
| Called by | [`GET http://localhost:4010/todos`](components/TodoPanel.md#req_1e93pbv41le) in [`TodoPanel`](components/TodoPanel.md) (matched by name and method) |
| Examples | 200 OK |

**Response** (from the examples) `{ id: number; userId: number; title: string; done: boolean }[]`

#### <a id="pmr_01yry56rvnp"></a>Get todo

|  |  |
| --- | --- |
| Request | `GET {{baseUrl}}/todos/:id` |
| URL | `http://localhost:4010/todos/:id` |
| Called by | nothing in the code |

> ⚠ **[unused-endpoint](GLOSSARY.md#flag-unused-endpoint)**: No request in the code calls this endpoint.

#### <a id="pmr_1jsi4tlr1i9"></a>Create todo

|  |  |
| --- | --- |
| Request | `POST {{baseUrl}}/todos` |
| URL | `http://localhost:4010/todos` |
| Called by | [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/TodoPanel.md#req_07zzxwzir2w) in [`TodoPanel`](components/TodoPanel.md) |
| Examples | 201 Created |

**Request body** `{ title: string; userId: number }`

**Response** (from the examples) `{ id: number; userId: number; title: string; done: boolean }`

## Unused endpoints (2)

No request in the code calls these.

- [Delete product](#pmr_072ggar1q9m) `DELETE /products/:id` (Products)
- [Get todo](#pmr_01yry56rvnp) `GET /todos/:id` (Todos)

## Requests not in the collection (1)

Requests in the code the collection has no request for.

| Request | From | Status |
| --- | --- | --- |
| [`DELETE {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](components/DeleteUserButton.md#req_1nhvqmicx4q) | [`DeleteUserButton`](components/DeleteUserButton.md) | ✓ verified (1 capture) |

## Contract mismatches (1)

Types in the code that don't fit the collection's saved examples.

- [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/products`](components/ProductPanel.md#req_08kv7zxxjyg): The response type Product\[\] doesn't match the Postman example "200 OK": \[\].price is number 49.9 (expected string).
