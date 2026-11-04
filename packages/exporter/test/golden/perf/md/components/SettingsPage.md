# Component `SettingsPage`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/settings/page.tsx:4` |
| Kind | server |
| Used on | [`/settings`](../pages/settings.md) |

## Props

Takes no props.

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET http://localhost:4010/settings?delay=40`](#req_1p429pabq9j) | server-render | [`SettingsPage`]() | inferred |
| [`GET http://localhost:4010/users/2?delay=80`](#req_1lhn3mfgf8g) | server-render | [`SettingsPage`]() | inferred |
| [`GET http://localhost:4010/users/1?delay=20`](#req_0vimi2c2ovq) | server-render | [`SettingsPage`]() | inferred |

### <a id="req_1p429pabq9j"></a>`GET http://localhost:4010/settings?delay=40`

|  |  |
| --- | --- |
| Status | inferred |
| From | [`SettingsPage`]() · `src/app/settings/page.tsx:5` |
| Trigger | server-render |
| Transport | axios |
| URL | `http://localhost:4010/settings?delay=40` |
| Call path | `getSettings` → `axios.get` |

**Response** [`Settings`](../types.md#typ_0vz15qy2iug)

```ts
{ theme: string; locale: string; digest: string | null }
```

### <a id="req_1lhn3mfgf8g"></a>`GET http://localhost:4010/users/2?delay=80`

|  |  |
| --- | --- |
| Status | inferred |
| From | [`SettingsPage`]() · `src/app/settings/page.tsx:5` |
| Trigger | server-render |
| Transport | fetch |
| URL | `http://localhost:4010/users/2?delay=80` |
| Call path | `getUser` → `get` → `fetch` |

**Response** [`User`](../types.md#typ_0mxt2h8i81o)

```ts
{ id: number; name: string; email: string; role: string }
```

### <a id="req_0vimi2c2ovq"></a>`GET http://localhost:4010/users/1?delay=20`

|  |  |
| --- | --- |
| Status | inferred |
| From | [`SettingsPage`]() · `src/app/settings/page.tsx:5` |
| Trigger | server-render |
| Transport | axios |
| URL | `http://localhost:4010/users/1?delay=20` |
| Call path | `getAccount` → `axios.get` |

**Response** [`User`](../types.md#typ_0mxt2h8i81o)

```ts
{ id: number; name: string; email: string; role: string }
```
