# Middleware `src/proxy.ts`

[← Overview](README.md)

|  |  |
| --- | --- |
| File | `src/proxy.ts:5` |
| Convention | `proxy` (Next.js 16+) |
| Export | `default` |
| Made with | `createMiddleware` from `next-intl/middleware` |
| Matcher | `/((?!api\|_next\|_vercel\|.*\..*).*)` |
| Locales | `en`, `ar` (default `en`) |

## Runs on

| Route | Kind | When |
| --- | --- | --- |
| [`/[locale]`](pages/%5Blocale%5D.md) | page | every request |
| [`/[locale]/dashboard`](pages/%5Blocale%5D.dashboard.md) | page | every request |
| [`/[locale]/login`](pages/%5Blocale%5D.login.md) | page | every request |
| [`/[locale]/verify`](pages/%5Blocale%5D.verify.md) | page | every request |

## Requests

The middleware sends no requests the scan found.
