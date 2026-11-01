# Page `/settings`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/settings/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | open |
| Status | ✓ 4 verified |

## Component tree

- [`SettingsPage`](../components/SettingsPage.md) · server
  - [`SettingsBadge`](../components/SettingsBadge.md) · client · ⇄ 1 request
  - [`SettingsPanel`](../components/SettingsPanel.md) · client · ⇄ 3 requests

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings`](#req_092dy6av59n) | page-load | [`SettingsBadge`](../components/SettingsBadge.md) | ✓ verified (2 captures) |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings`](#req_1psqg80jksx) | page-load | [`SettingsPanel`](../components/SettingsPanel.md) | ✓ verified (2 captures) |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](#req_01zlsrjrncf) | page-load | [`SettingsPanel`](../components/SettingsPanel.md) | ✓ verified (1 capture) |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](#req_1dhqpyygtma) | page-load | [`SettingsPanel`](../components/SettingsPanel.md) | ✓ verified (1 capture) |

### <a id="req_092dy6av59n"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`SettingsBadge`](../components/SettingsBadge.md) · `src/components/SettingsBadge.tsx:9` |
| Trigger | page-load |
| Transport | fetch · `useQuery([QueryKey.Settings])` · key `['settings']` |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings` |
| Call path | `useApiQuery` → `useQuery` → `http` → `fetch` |

**Response** [`Settings`](../types.md#typ_0ccr3ev5sff)

```ts
{ theme: "light" | "dark"; locale: string; digest: string | null }
```

**Captured** `GET http://localhost:4010/settings` → 200 OK · 7 ms · 2026-10-31 22:51 UTC · page `/settings` (newest of 2)

Response body:

```json
{
  "theme": "dark",
  "locale": "en",
  "digest": null
}
```

### <a id="req_1psqg80jksx"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`SettingsPanel`](../components/SettingsPanel.md) · `src/components/SettingsPanel.tsx:15` |
| Trigger | page-load |
| Transport | fetch · `useQuery([QueryKey.Settings])` · key `['settings']` |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings` |
| Call path | `useApiQuery` → `useQuery` → `http` → `fetch` |

**Response** [`Settings`](../types.md#typ_0ccr3ev5sff)

```ts
{ theme: "light" | "dark"; locale: string; digest: string | null }
```

**Captured** `GET http://localhost:4010/settings` → 200 OK · 7 ms · 2026-10-31 22:51 UTC · page `/settings` (newest of 2)

Response body:

```json
{
  "theme": "dark",
  "locale": "en",
  "digest": null
}
```

### <a id="req_01zlsrjrncf"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`SettingsPanel`](../components/SettingsPanel.md) · `src/components/SettingsPanel.tsx:16` |
| Trigger | page-load |
| Transport | fetch · `useQuery([SCOPES.users, STATS])` · key `['users', 'stats']` |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users` |
| Call path | `useQuery` → `http` → `fetch` |

**Response** `User[]` (see [`User`](../types.md#typ_25sov0zzv45))

**Captured** `GET http://localhost:4010/users` → 200 OK · 8 ms · 2026-10-31 22:51 UTC · page `/settings`

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

### <a id="req_1dhqpyygtma"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`SettingsPanel`](../components/SettingsPanel.md) · `src/components/SettingsPanel.tsx:17` |
| Trigger | page-load |
| Transport | fetch · `useQuery([version, 'todos'])` · key `[?version, 'todos']` |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos` |
| Call path | `useQuery` → `http` → `fetch` |

**Response** `Todo[]` (see [`Todo`](../types.md#typ_0fc96ucq8sd))

**Captured** `GET http://localhost:4010/todos` → 200 OK · 7 ms · 2026-10-31 22:51 UTC · page `/settings`

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
    "done": true
  },
  {
    "id": 3,
    "userId": 1,
    "done": false,
    "title": "Record captures"
  }
]
```
