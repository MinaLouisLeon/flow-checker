# Component `SettingsPage`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/dashboard/settings/page.tsx:5` |
| Kind | server |
| Used on | [`/dashboard/settings`](../pages/dashboard.settings.md) |

## Props

Takes no props.

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {API_URL ?? http://localhost:4010}/settings`](#req_0q6t9lmdld7) | server-render | [`SettingsPage`]() | ✓ verified (1 capture) |

### <a id="req_0q6t9lmdld7"></a>`GET {API_URL ?? http://localhost:4010}/settings`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`SettingsPage`]() · `app/dashboard/settings/page.tsx:6` |
| Trigger | server-render |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/settings` |
| Call path | `getSettings` → `fetch` |

**Response** [`Settings`](../types.md#typ_21gfaviyj48)

```ts
{ theme: string; locale: string; digest: string | null }
```

**Captured** `GET http://localhost:4010/settings` → 200 OK · 14 ms · 2026-10-30 02:42 UTC

Response body:

```json
{
  "theme": "dark",
  "locale": "en",
  "digest": null
}
```
