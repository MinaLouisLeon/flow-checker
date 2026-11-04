# Page `/settings`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/settings/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) → [`SettingsLayout`](../components/SettingsLayout.md) (`src/app/settings/layout.tsx`) |
| Access | open |
| Rendering | dynamic |
| Title | `Perf` |
| Status | ✓ 1 verified, 5 inferred |

## Rendering

- dynamic: fetches with `cache: 'no-store'` (layout), `src/lib/api.ts:8`

## Boundaries

- While it loads: nothing, navigation waits for the page
- On an error: Next's default error page
- On `notFound()`: Next's default 404 page
- ⚠ no loading state: waits for a request (`fetch`) (and 5 more) with no `loading` file or `<Suspense>` to show meanwhile (layout), `src/lib/api.ts:8`
- ⚠ no error boundary: fetches on the server (`fetch`) (and 5 more), and no `error` file, error boundary or `global-error` catches a failure (layout), `src/lib/api.ts:8`

## Client boundaries

Nothing runs in the browser: every component renders on the server.

## Request performance

Requests that slow this page down ([all](../perf.md)).

- ⚠ **[duplicate](../GLOSSARY.md#perf-duplicate)**, [confirmed at runtime](../GLOSSARY.md#perf-confirmed) (`src/app/settings/page.tsx:5`): `GET http://localhost:4010/settings?delay=40` is sent from 2 places on one page load and nothing dedupes it.
  - confirmed at runtime in 2 of 2 loads: up to 2 requests per load, 54 ms together.

## Metadata

- layout `metadata`: title, template `%s | Perf`, `src/app/layout.tsx:5`

## Component tree

- [`SettingsPage`](../components/SettingsPage.md) · server · ⇄ 3 requests

## Navigation

- From [`/`](index.md) (link)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET http://localhost:4010/settings?delay=40`](#req_147qy0vyz3e) | server-render | [`SettingsLayout`](../components/SettingsLayout.md) | inferred |
| [`GET http://localhost:4010/users/2?delay=80`](#req_1rc36qnaspk) | server-render | [`SettingsLayout`](../components/SettingsLayout.md) | ✓ verified (2 captures) |
| [`GET http://localhost:4010/users/1?delay=20`](#req_03bknq0ncj5) | server-render | [`SettingsLayout`](../components/SettingsLayout.md) | inferred |
| [`GET http://localhost:4010/settings?delay=40`](#req_1p429pabq9j) | server-render | [`SettingsPage`](../components/SettingsPage.md) | inferred |
| [`GET http://localhost:4010/users/2?delay=80`](#req_1lhn3mfgf8g) | server-render | [`SettingsPage`](../components/SettingsPage.md) | inferred |
| [`GET http://localhost:4010/users/1?delay=20`](#req_0vimi2c2ovq) | server-render | [`SettingsPage`](../components/SettingsPage.md) | inferred |

### <a id="req_147qy0vyz3e"></a>`GET http://localhost:4010/settings?delay=40`

|  |  |
| --- | --- |
| Status | inferred |
| From | [`SettingsLayout`](../components/SettingsLayout.md) · `src/app/settings/layout.tsx:8` |
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
| From | [`SettingsLayout`](../components/SettingsLayout.md) · `src/app/settings/layout.tsx:8` |
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
| From | [`SettingsLayout`](../components/SettingsLayout.md) · `src/app/settings/layout.tsx:8` |
| Trigger | server-render |
| Transport | axios |
| URL | `http://localhost:4010/users/1?delay=20` |
| Call path | `getAccount` → `axios.get` |

**Response** [`User`](../types.md#typ_0mxt2h8i81o)

```ts
{ id: number; name: string; email: string; role: string }
```

### <a id="req_1p429pabq9j"></a>`GET http://localhost:4010/settings?delay=40`

|  |  |
| --- | --- |
| Status | inferred |
| From | [`SettingsPage`](../components/SettingsPage.md) · `src/app/settings/page.tsx:5` |
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
| From | [`SettingsPage`](../components/SettingsPage.md) · `src/app/settings/page.tsx:5` |
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
| From | [`SettingsPage`](../components/SettingsPage.md) · `src/app/settings/page.tsx:5` |
| Trigger | server-render |
| Transport | axios |
| URL | `http://localhost:4010/users/1?delay=20` |
| Call path | `getAccount` → `axios.get` |

**Response** [`User`](../types.md#typ_0mxt2h8i81o)

```ts
{ id: number; name: string; email: string; role: string }
```
