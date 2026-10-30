# Page `/[locale]/login`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/[locale]/login/page.tsx` |
| Layouts | [`LocaleLayout`](../components/LocaleLayout.md) (`src/app/[locale]/layout.tsx`) |
| Status | ✓ 1 verified |

## Component tree

- [`LoginPage`](../components/LoginPage.md) · server
  - [`LoginForm`](../components/LoginForm.md) · client · ⇄ 1 request

## Navigation

- From [`/[locale]`](%5Blocale%5D.md) (link)
- From [`/[locale]/dashboard`](%5Blocale%5D.dashboard.md) (push, link)
- To [`/[locale]/verify`](%5Blocale%5D.verify.md) (push)
- From [`/[locale]/verify`](%5Blocale%5D.verify.md) (link)

## Flows

- [LoginForm submit](../flows/loginform-submit.md)

## Middleware

[`src/proxy.ts`](../middleware.md) runs before every request to this route.

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/auth/login`](#req_0ldgejuv5rs) | event onSubmit | [`LoginForm`](../components/LoginForm.md) | ✓ verified (1 capture) |

### <a id="req_0ldgejuv5rs"></a>`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/auth/login`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`LoginForm`](../components/LoginForm.md) · `src/components/LoginForm.tsx:18` |
| Trigger | event onSubmit |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/auth/login` |
| Call path | `login` → `post` → `fetch` |

**Request body** [`LoginRequest`](../types.md#typ_0soatqi8re7)

```ts
{ email: string; password: string }
```

**Response** [`LoginResponse`](../types.md#typ_1ywasj4ylf5)

```ts
{ otpRequired: true; challengeId: string }
```

**Captured** `POST http://localhost:4010/auth/login` → 200 OK · 12 ms · 2026-10-28 10:58 UTC · page `/en/login`

Request body:

```json
{
  "email": "ada@example.com",
  "password": "[REDACTED:string]"
}
```

Response body:

```json
{
  "otpRequired": true,
  "challengeId": "515708eb-7e2d-462b-b51a-de5c05e6f6f7"
}
```

Masked: `request.body.password`
