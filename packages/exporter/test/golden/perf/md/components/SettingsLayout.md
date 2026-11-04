# Component `SettingsLayout`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/settings/layout.tsx:7` |
| Kind | server |
| Used on | [`/settings`](../pages/settings.md) |

## Props

`{ children: ReactNode }`

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET http://localhost:4010/settings?delay=40`](#req_147qy0vyz3e) | server-render | [`SettingsLayout`]() | inferred |
| [`GET http://localhost:4010/users/2?delay=80`](#req_1rc36qnaspk) | server-render | [`SettingsLayout`]() | ✓ verified (2 captures) |
| [`GET http://localhost:4010/users/1?delay=20`](#req_03bknq0ncj5) | server-render | [`SettingsLayout`]() | inferred |

### <a id="req_147qy0vyz3e"></a>`GET http://localhost:4010/settings?delay=40`

|  |  |
| --- | --- |
| Status | inferred |
| From | [`SettingsLayout`]() · `src/app/settings/layout.tsx:8` |
| Trigger | server-render |
| Transport | axios |
| URL | `http://localhost:4010/settings?delay=40` |
| Call path | `getSettings` → `axios.get` |

**Response** [`Settings`](../types.md#typ_0vz15qy2iug)

```ts
{ theme: string; locale: string; digest: string | null }
```

### <a id="req_1rc36qnaspk"></a>`GET http://localhost:4010/users/2?delay=80`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`SettingsLayout`]() · `src/app/settings/layout.tsx:8` |
| Trigger | server-render |
| Transport | fetch |
| URL | `http://localhost:4010/users/2?delay=80` |
| Call path | `getUser` → `get` → `fetch` |

**Response** [`User`](../types.md#typ_0mxt2h8i81o)

```ts
{ id: number; name: string; email: string; role: string }
```

**Captured** `GET http://localhost:4010/users/2?delay=80` → 200 OK · 97 ms · 2026-11-04 11:21 UTC (newest of 2)

Response body:

```json
{
  "id": 2,
  "name": "Alan Turing",
  "email": "alan@example.com",
  "role": "member"
}
```

### <a id="req_03bknq0ncj5"></a>`GET http://localhost:4010/users/1?delay=20`

|  |  |
| --- | --- |
| Status | inferred |
| From | [`SettingsLayout`]() · `src/app/settings/layout.tsx:8` |
| Trigger | server-render |
| Transport | axios |
| URL | `http://localhost:4010/users/1?delay=20` |
| Call path | `getAccount` → `axios.get` |

**Response** [`User`](../types.md#typ_0mxt2h8i81o)

```ts
{ id: number; name: string; email: string; role: string }
```
