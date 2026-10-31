# Component `SettingsBadge`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/SettingsBadge.tsx:8` |
| Kind | client (`'use client'`) |
| Used on | [`/settings`](../pages/settings.md) |
| Rendered by | [`SettingsPage`](SettingsPage.md) |

## Props

Takes no props.

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings`](#req_092dy6av59n) | page-load | [`SettingsBadge`]() | ✓ verified (2 captures) |

### <a id="req_092dy6av59n"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`SettingsBadge`]() · `src/components/SettingsBadge.tsx:9` |
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
