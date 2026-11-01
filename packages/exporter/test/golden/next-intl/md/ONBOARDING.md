# next-intl: start here

A short tour of this Next.js 16.4.3 app, read from its code by flow-checker. [The full docs](README.md) have every page, component, request and flow.

## Stack

- Next.js: [16.4.3](README.md) (App Router in src/app/, 4 pages, 0 route handlers)
- Rendering: [5 server, 3 client, 0 shared](README.md) (8 components)
- Data: fetch (3 requests)
- i18n: [next-intl](README.md) (locales en, ar)
- Proxy: [`src/proxy.ts`](middleware.md) (runs on 4 routes, made by next-intl/middleware)

## Areas

4 areas by URL.

- home: [`/`](areas.md#ar_1vn39fso9m3) (1 page)
- dashboard: [`/[locale]/dashboard`](areas.md#ar_1q9mt49i536) (1 page, 1 endpoint)
- login: [`/[locale]/login`](areas.md#ar_0pgtfiopjqa) (1 page, 1 flow, 1 endpoint)
- verify: [`/[locale]/verify`](areas.md#ar_1fio74g3hsz) (1 page, 1 endpoint)

## Entry pages

- Start page: [`/[locale]`](pages/%5Blocale%5D.md)
- Most linked: [`/[locale]/login`](pages/%5Blocale%5D.login.md) (3 pages link here)

## Main flows

1 flow, 0 confirmed.

- LoginForm submit: [`/[locale]/login → /[locale]/verify → /[locale]/dashboard`](flows/loginform-submit.md) (7 steps)

## Backends

3 endpoints.

- External: [`{NEXT_PUBLIC_API_URL ?? http://localhost:4010}`](endpoints.md#host-env_NEXT_PUBLIC_API_URL) (3 endpoints, 3 called from the browser)

## Where things live

- Root layout: [`src/app/[locale]/layout.tsx`](components/LocaleLayout.md)
- Sends requests: `src/lib/auth-api.ts` (3 requests)
- Type: [`User`](types.md#typ_1tpxqokvkch) (src/types/auth.ts, used 3 times)

## To check

The scan resolved every page, component, type and request.
