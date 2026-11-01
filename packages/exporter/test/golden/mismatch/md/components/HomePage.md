# Component `HomePage`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/page.tsx:8` |
| Kind | server |
| Used on | [`/`](../pages/index.md) |
| Renders | [`SettingsPanel`](SettingsPanel.md), [`TodoPanel`](TodoPanel.md) |

## Props

Takes no props.

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](#req_13cmzl2vi57) | server-render | [`HomePage`]() | ✗ type mismatch (2 captures) |

### <a id="req_13cmzl2vi57"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`

|  |  |
| --- | --- |
| Status | ✗ type mismatch (2 captures) |
| From | [`HomePage`]() · `app/page.tsx:9` |
| Trigger | server-render |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users` |
| Call path | `getAccounts` → `fetch` |

> ⚠ **[type-mismatch](../GLOSSARY.md#flag-type-mismatch)**: Response doesn't match Account\[\]: \[\].id is number 1 (expected string); \[\].avatarUrl is missing (expected string); \[\].role is not in the type (2 of 2 captures).

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
