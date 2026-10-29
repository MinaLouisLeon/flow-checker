# Page `/`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`app/layout.tsx`) |
| Status | ✓ 1 verified, ✗ 3 mismatch |

## Component tree

- [`HomePage`](../components/HomePage.md) · server · ⇄ 1 request
  - [`SettingsPanel`](../components/SettingsPanel.md) · client · ⇄ 1 request
  - [`TodoPanel`](../components/TodoPanel.md) · client · ⇄ 2 requests

## Flows

- [TodoPanel submit](../flows/todopanel-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](#req_13cmzl2vi57) | server-render | [`HomePage`](../components/HomePage.md) | ✗ type mismatch (2 captures) |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings`](#req_23elzbn49tu) | effect | [`SettingsPanel`](../components/SettingsPanel.md) | ✗ type mismatch (2 captures) |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](#req_1a4xvnngrvj) | effect | [`TodoPanel`](../components/TodoPanel.md) | ✓ verified (2 captures) |
| [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](#req_1m9d40sdmxx) | event onSubmit | [`TodoPanel`](../components/TodoPanel.md) | ✗ type mismatch (1 capture) |

### <a id="req_13cmzl2vi57"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`

|  |  |
| --- | --- |
| Status | ✗ type mismatch (2 captures) |
| From | [`HomePage`](../components/HomePage.md) · `app/page.tsx:9` |
| Trigger | server-render |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users` |
| Call path | `getAccounts` → `fetch` |

> ⚠ **type-mismatch**: Response doesn't match Account\[\]: \[\].id is number 1 (expected string); \[\].avatarUrl is missing (expected string); \[\].role is not in the type (2 of 2 captures).

**Response** `Account[]` (see [`Account`](../types.md#typ_2fa1fwnmo05))

**Type check**: 2 of 2 checked captures didn't match.

| Part | Field | Problem | Expected | Captured | Captures |
| --- | --- | --- | --- | --- | ---: |
| response | `[].id` | wrong-type | `string` | `number 1` | 2 |
| response | `[].avatarUrl` | missing-field | `string` | `missing` | 2 |
| response | `[].role` | extra-field | `not declared` | `string "admin"` | 2 |

**Captured** `GET http://localhost:4010/users` → 200 OK · 29 ms · 2026-10-29 12:38 UTC (newest of 2)

Response body:

```json
[
  {
    "id": 1,
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "role": "admin"
  },
  {
    "id": 2,
    "name": "Alan Turing",
    "email": "alan@example.com",
    "role": "member"
  }
]
```

### <a id="req_23elzbn49tu"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings`

|  |  |
| --- | --- |
| Status | ✗ type mismatch (2 captures) |
| From | [`SettingsPanel`](../components/SettingsPanel.md) · `components/SettingsPanel.tsx:12` |
| Trigger | effect |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings` |
| Call path | `getSettings` → `fetch` |

> ⚠ **type-mismatch**: Response doesn't match Settings: digest is null (expected { frequency: "daily" \| "weekly" }) (2 of 2 captures).

**Response** [`Settings`](../types.md#typ_0xjkp2la9ri)

```ts
{
  theme: "light" | "dark"
  locale: string
  digest: { frequency: "daily" | "weekly" }
}
```

**Type check**: 2 of 2 checked captures didn't match.

| Part | Field | Problem | Expected | Captured | Captures |
| --- | --- | --- | --- | --- | ---: |
| response | `digest` | null | `{ frequency: "daily" \| "weekly" }` | `null` | 2 |

**Captured** `GET http://localhost:4010/settings` → 200 OK · 12 ms · 2026-10-29 12:38 UTC · page `/` (newest of 2)

Response body:

```json
{
  "theme": "dark",
  "locale": "en",
  "digest": null
}
```

### <a id="req_1a4xvnngrvj"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodoPanel`](../components/TodoPanel.md) · `components/TodoPanel.tsx:13` |
| Trigger | effect |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos` |
| Call path | `getTodos` → `fetch` |

**Response** `Todo[]` (see [`Todo`](../types.md#typ_29n1iw0u1hd))

**Captured** `GET http://localhost:4010/todos` → 200 OK · 9 ms · 2026-10-29 12:38 UTC · page `/` (newest of 2)

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
  }
]
```

### <a id="req_1m9d40sdmxx"></a>`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✗ type mismatch (1 capture) |
| From | [`TodoPanel`](../components/TodoPanel.md) · `components/TodoPanel.tsx:19` |
| Trigger | event onSubmit |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos` |
| Call path | `createTodo` → `fetch` |

> ⚠ **type-mismatch**: Response doesn't match Todo: userId is string "1" (expected number). Request body doesn't match NewTodo: userId is string "1" (expected number) (1 of 1 capture).

**Request body** [`NewTodo`](../types.md#typ_1hvhy5iwv7p)

```ts
{ title: string; userId: number }
```

**Response** [`Todo`](../types.md#typ_29n1iw0u1hd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Type check**: 1 of 1 checked capture didn't match.

| Part | Field | Problem | Expected | Captured | Captures |
| --- | --- | --- | --- | --- | ---: |
| request body | `userId` | wrong-type | `number` | `string "1"` | 1 |
| response | `userId` | wrong-type | `number` | `string "1"` | 1 |

**Captured** `POST http://localhost:4010/todos` → 201 Created · 10 ms · 2026-10-29 12:38 UTC · page `/`

Request body:

```json
{
  "title": "Check types",
  "userId": "1"
}
```

Response body:

```json
{
  "id": 3,
  "userId": "1",
  "done": false,
  "title": "Check types"
}
```
