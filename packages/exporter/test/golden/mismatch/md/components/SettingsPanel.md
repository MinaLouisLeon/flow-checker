# Component `SettingsPanel`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `components/SettingsPanel.tsx:8` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |

## Props

Takes no props.

## Types used

- [`Settings`](../types.md#typ_0xjkp2la9ri)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings`](#req_23elzbn49tu) | effect | [`SettingsPanel`]() | ✗ type mismatch (2 captures) |

### <a id="req_23elzbn49tu"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings`

|  |  |
| --- | --- |
| Status | ✗ type mismatch (2 captures) |
| From | [`SettingsPanel`]() · `components/SettingsPanel.tsx:12` |
| Trigger | effect |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings` |
| Call path | `getSettings` → `fetch` |

> ⚠ **[type-mismatch](../GLOSSARY.md#flag-type-mismatch)**: Response doesn't match Settings: digest is null (expected { frequency: "daily" \| "weekly" }) (2 of 2 captures).

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
