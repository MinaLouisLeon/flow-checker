# Component `AddTodoForm`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/AddTodoForm.tsx:16` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |

## Props

Takes no props.

## Navigation

- push `/todos/:id` → [`/todos/[id]`](../pages/todos.%5Bid%5D.md) · event onSubmit · on success · `src/components/AddTodoForm.tsx:24`

## Flows

- [AddTodoForm submit](../flows/addtodoform-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/graphql`](#req_1ncc9k5xsh8) | event onSubmit | [`AddTodoForm`]() | ✓ verified (1 capture) |

### <a id="req_1ncc9k5xsh8"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`AddTodoForm`]() · `src/components/AddTodoForm.tsx:19` |
| Trigger | event onSubmit |
| Transport | graphql · `useMutation` |
| URL | `/api/graphql` |
| GraphQL | [`AddTodo`](../graphql.md#operation-AddTodo) (mutation) |
| Handled by | [`/api/graphql`](../pages/api.graphql.md) |

**Request body** `AddTodoMutationVariables`

```ts
{ input: { title: string; ownerId?: string | null } }
```

**Response** `AddTodoMutation`

```ts
{ addTodo: { id: string; title: string } }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 36 ms · 2026-10-30 10:34 UTC · page `/`

Request body:

```json
{
  "operationName": "AddTodo",
  "query": "mutation AddTodo($input: AddTodoInput!) {\n  addTodo(input: $input) {\n    id\n    title\n    __typename\n  }\n}",
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
      "title": "Record captures",
      "__typename": "Todo"
    }
  }
}
```
