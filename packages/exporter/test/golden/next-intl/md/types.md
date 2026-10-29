# Types

[← Overview](README.md)

6 named types, fully resolved.

## <a id="typ_1c9vagn0sce"></a>VerifyOtpFormProps

interface · `src/components/VerifyOtpForm.tsx:8`

```ts
interface VerifyOtpFormProps { challengeId: string | null }
```

Used by: props of [`VerifyOtpForm`](components/VerifyOtpForm.md).

## <a id="typ_1tpxqokvkch"></a>User

interface · `src/types/auth.ts:1`

```ts
interface User { id: number; name: string; email: string; role: "admin" | "member" }
```

Used by: used in [`DashboardProfile`](components/DashboardProfile.md), request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/me`](components/DashboardProfile.md#req_1ostg0bhzmk), in [`VerifyOtpResponse`](#typ_1pi4a892sek).

## <a id="typ_0soatqi8re7"></a>LoginRequest

interface · `src/types/auth.ts:8`

```ts
interface LoginRequest { email: string; password: string }
```

Used by: request [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/auth/login`](components/LoginForm.md#req_0ldgejuv5rs).

## <a id="typ_1ywasj4ylf5"></a>LoginResponse

interface · `src/types/auth.ts:13`

```ts
interface LoginResponse { otpRequired: true; challengeId: string }
```

Used by: request [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/auth/login`](components/LoginForm.md#req_0ldgejuv5rs).

## <a id="typ_0picqcg78cw"></a>VerifyOtpRequest

interface · `src/types/auth.ts:18`

```ts
interface VerifyOtpRequest { challengeId: string; code: string }
```

Used by: request [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/auth/verify-otp`](components/VerifyOtpForm.md#req_0ivpze9dolu).

## <a id="typ_1pi4a892sek"></a>VerifyOtpResponse

interface · `src/types/auth.ts:23`

```ts
interface VerifyOtpResponse { token: string; user: User }
```

Used by: request [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/auth/verify-otp`](components/VerifyOtpForm.md#req_0ivpze9dolu).
