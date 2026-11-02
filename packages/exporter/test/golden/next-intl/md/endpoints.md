# Endpoints

[← Overview](README.md)

3 endpoints on 1 host, 3 called from the browser. One endpoint is a method and URL pattern; tRPC procedures, GraphQL operations and server actions count one each. Requests to this app's own route handlers are listed under "This app's API", and what those handlers send on under the host it goes to.

## <a id="host-env_NEXT_PUBLIC_API_URL"></a>`{NEXT_PUBLIC_API_URL ?? http://localhost:4010}`

Base URL from `process.env.NEXT_PUBLIC_API_URL`, falls back to `http://localhost:4010`.

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`POST /auth/login`](#ep_0plop0v393x) | HTTP | browser | 1 | 1 | ✓ verified |
| [`POST /auth/verify-otp`](#ep_07z00ubkge9) | HTTP | browser | 1 | 1 | ✓ verified |
| [`GET /me`](#ep_1rz8dmsxgvx) | HTTP | browser | 1 | 1 | ✓ verified |

### <a id="ep_0plop0v393x"></a>`POST /auth/login`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | browser |
| Pages | [`/[locale]/login`](pages/%5Blocale%5D.login.md) |
| Call sites | [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/auth/login`](components/LoginForm.md#req_0ldgejuv5rs) in [`LoginForm`](components/LoginForm.md) |

**Request body** [`LoginRequest`](types.md#typ_0soatqi8re7)

```ts
{ email: string; password: string }
```

**Response** [`LoginResponse`](types.md#typ_1ywasj4ylf5)

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

### <a id="ep_07z00ubkge9"></a>`POST /auth/verify-otp`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | browser |
| Pages | [`/[locale]/verify`](pages/%5Blocale%5D.verify.md) |
| Call sites | [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/auth/verify-otp`](components/VerifyOtpForm.md#req_0ivpze9dolu) in [`VerifyOtpForm`](components/VerifyOtpForm.md) |

**Request body** [`VerifyOtpRequest`](types.md#typ_0picqcg78cw)

```ts
{ challengeId: string; code: string }
```

**Response** [`VerifyOtpResponse`](types.md#typ_1pi4a892sek)

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

### <a id="ep_1rz8dmsxgvx"></a>`GET /me`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | browser |
| Pages | [`/[locale]/dashboard`](pages/%5Blocale%5D.dashboard.md) |
| Call sites | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/me`](components/DashboardProfile.md#req_1ostg0bhzmk) in [`DashboardProfile`](components/DashboardProfile.md) |

**Response** `User | null` (see [`User`](types.md#typ_1tpxqokvkch))

**Captured** `GET http://localhost:4010/me` → 200 OK · 55 ms · 2026-10-28 10:58 UTC · page `/en/dashboard` (newest of 2)

Response body:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "role": "admin"
}
```

Masked: `request.headers.authorization`
