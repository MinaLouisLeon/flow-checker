# Page `/`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | open |
| Rendering | static |
| Title | `Relay fixture` |
| Status | ✓ 2 verified |

## Boundaries

- While it loads: only the `<Suspense>` parts below
- On an error: Next's default error page
- On `notFound()`: Next's default 404 page
- `<Suspense>` around `TodoList` (page), `src/app/page.tsx:11`

## Client boundaries

4 `'use client'` boundaries bring 5 components and 6 project modules (about 3.3 KB of source) to the browser, plus 2 packages (`react-relay`, `relay-runtime`).

- [`Providers`](../components/Providers.md), rendered by `RootLayout` (layout): 1 component · 2 modules · 0.9 KB, `src/app/layout.tsx:10`
  - packages: `react-relay`, `relay-runtime`
- [`ClientOnly`](../components/ClientOnly.md), rendered by `HomePage` (page): 1 component · 1 module · 0.4 KB, `src/app/page.tsx:10`
- [`TodoList`](../components/TodoList.md), rendered by `HomePage` (page): 2 components · 2 modules · 1.0 KB, `src/app/page.tsx:12`
  - packages: `react-relay`
- [`AddTodoForm`](../components/AddTodoForm.md), rendered by `HomePage` (page): 1 component · 1 module · 0.9 KB, `src/app/page.tsx:15`
  - packages: `react-relay`

## Metadata

- layout `metadata`: title, `src/app/layout.tsx:4`

## Component tree

- [`HomePage`](../components/HomePage.md) · server
  - [`ClientOnly`](../components/ClientOnly.md) · client
  - `Suspense` · external (`react`)
  - [`TodoList`](../components/TodoList.md) · client · ⇄ 1 request
    - [`TodoItem`](../components/TodoItem.md) · client
      - `Link` · external (`next/link`)
  - [`AddTodoForm`](../components/AddTodoForm.md) · client · ⇄ 1 request

## Navigation

- To [`/todos/[id]`](todos.%5Bid%5D.md) (push, link)

## Flows

- [AddTodoForm submit](../flows/addtodoform-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/graphql`](#req_25b0dzm9av8) | event onSubmit | [`AddTodoForm`](../components/AddTodoForm.md) | ✓ verified (1 capture) |
| [`POST /api/graphql`](#req_0ixcyoz99u0) | page-load | [`TodoList`](../components/TodoList.md) | ✓ verified (1 capture) |

### <a id="req_25b0dzm9av8"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`AddTodoForm`](../components/AddTodoForm.md) · `src/components/AddTodoForm.tsx:11` |
| Trigger | event onSubmit |
| Transport | graphql · `useMutation` |
| URL | `/api/graphql` |
| GraphQL | [`AddTodoFormMutation`](../graphql.md#operation-AddTodoFormMutation) (mutation) |
| Handled by | [`/api/graphql`](api.graphql.md) |

**Request body** [`AddTodoFormMutation$variables`](../types.md#typ_1jk7p5vwxhg)

```ts
{ input: AddTodoInput }
```

**Response** [`AddTodoFormMutation$data`](../types.md#typ_07be3pbscua)

```ts
{ readonly addTodo: { readonly id: string; readonly title: string } }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 33 ms · 2026-10-30 10:34 UTC · page `/`

Request body:

```json
{
  "doc_id": "7b287a25c92827de62ee76b0bdbdc3a1f06652f85ea710168f89cd568052bf8d",
  "variables": {
    "input": {
      "title": "Record captures"
    }
  }
}
```

Response body:

```json
{
  "data": {
    "addTodo": {
      "id": "4",
      "title": "Record captures"
    }
  }
}
```

### <a id="req_0ixcyoz99u0"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoList`](../components/TodoList.md) · `src/components/TodoList.tsx:8` |
| Trigger | page-load |
| Transport | graphql · `useLazyLoadQuery` |
| URL | `/api/graphql` |
| GraphQL | [`TodoListQuery`](../graphql.md#operation-TodoListQuery) (query) |
| Handled by | [`/api/graphql`](api.graphql.md) |

**Request body** [`TodoListQuery$variables`](../types.md#typ_0sd209oo5ki)

```ts
{ [key: string]: never }
```

**Response** `TodoListQuery$data`

```ts
{
  readonly todos: readonly { readonly id: string; readonly done: boolean; readonly title: string }[]
}
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 370 ms · 2026-10-30 10:34 UTC · page `/`

Request body:

```json
{
  "doc_id": "3f68cfe7f95fdfd770274ece724d3623c361f4a0c3a21e96fdfbf28d3d75153d",
  "variables": {}
}
```

Response body:

```json
{
  "data": {
    "todos": [
      {
        "id": "1",
        "title": "Write the schema",
        "done": true
      },
      {
        "id": "2",
        "title": "Add a route handler",
        "done": false
      },
      {
        "id": "3",
        "title": "Try a persisted query",
        "done": false
      }
    ]
  }
}
```
