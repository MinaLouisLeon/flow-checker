# Page `/[locale]/verify`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/[locale]/verify/page.tsx` |
| Layouts | [`LocaleLayout`](../components/LocaleLayout.md) (`src/app/[locale]/layout.tsx`) |
| Status | ✓ 1 verified |

## Component tree

- [`VerifyPage`](../components/VerifyPage.md) · server
  - [`VerifyOtpForm`](../components/VerifyOtpForm.md) · client · ⇄ 1 request
    - `Link` · external (`next-intl/navigation`) · conditional

## Navigation

- From [`/[locale]/login`](%5Blocale%5D.login.md) (push)
- To [`/[locale]/login`](%5Blocale%5D.login.md) (link)
- To [`/[locale]/dashboard`](%5Blocale%5D.dashboard.md) (replace)

## Flows

- [LoginForm submit](../flows/loginform-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/auth/verify-otp`](#req_0ivpze9dolu) | event onSubmit | [`VerifyOtpForm`](../components/VerifyOtpForm.md) | ✓ verified (1 capture) |

### <a id="req_0ivpze9dolu"></a>`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/auth/verify-otp`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`VerifyOtpForm`](../components/VerifyOtpForm.md) · `src/components/VerifyOtpForm.tsx:27` |
| Trigger | event onSubmit |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/auth/verify-otp` |
| Call path | `verifyOtp` → `post` → `fetch` |

**Request body** [`VerifyOtpRequest`](../types.md#typ_0picqcg78cw)

```ts
{ challengeId: string; code: string }
```

**Response** [`VerifyOtpResponse`](../types.md#typ_1pi4a892sek)

```ts
{ token: string; user: User }
```

**Captured** `POST http://localhost:4010/auth/verify-otp` → 200 OK · 7 ms · 2026-10-28 10:58 UTC · page `/en/verify`

Request body:

```json
{
  "challengeId": "515708eb-7e2d-462b-b51a-de5c05e6f6f7",
  "code": "[REDACTED:string]"
}
```

Response body:

```json
{
  "token": "[REDACTED:string]",
  "user": {
    "id": 1,
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "role": "admin"
  }
}
```

Masked: `request.body.code`, `response.body.token`
