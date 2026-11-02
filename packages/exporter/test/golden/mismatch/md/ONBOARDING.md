# mismatch: start here

A short tour of this Next.js 16.4.3 app, read from its code by flow-checker. [The full docs](README.md) have every page, component, request and flow.

## Stack

- Next.js: [16.4.3](README.md) (App Router in app/, 1 page, 0 route handlers)
- Rendering: [2 server, 2 client, 0 shared](README.md) (4 components)
- Data: fetch (4 requests)

## Areas

1 area by URL.

- home: [`/`](areas.md#ar_1vn39fso9m3) (1 page, 1 flow, 4 endpoints)

## Entry pages

- Start page: [`/`](pages/index.md)

## Main flows

1 flow, 0 confirmed.

- TodoPanel submit: [`/`](flows/todopanel-submit.md) (2 steps)

## Backends

4 endpoints.

- External: [`{NEXT_PUBLIC_API_URL ?? http://localhost:4010}`](endpoints.md#host-env_NEXT_PUBLIC_API_URL) (4 endpoints, 3 called from the browser)

## Where things live

- Root layout: [`app/layout.tsx`](components/RootLayout.md)
- Sends requests: `lib/api.ts` (4 requests)
- Type: [`Todo`](types.md#typ_29n1iw0u1hd) (types/index.ts, used 3 times)
- Type: [`Settings`](types.md#typ_0xjkp2la9ri) (types/index.ts, used 2 times)

## To check

3 open notes.

- Type mismatch: [GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users: Response doesn't match Account\[\]: \[\].id is number 1 (expected string); \[\].avatarUrl is missing (expected string); \[\].role is not in the type (2 of 2 captures).](components/HomePage.md#req_13cmzl2vi57) (app/page.tsx:9)
- Type mismatch: [GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings: Response doesn't match Settings: digest is null (expected { frequency: "daily" \| "weekly" }) (2 of 2 captures).](components/SettingsPanel.md#req_23elzbn49tu) (components/SettingsPanel.tsx:12)
- Type mismatch: [POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos: Response doesn't match Todo: userId is string "1" (expected number). Request body doesn't match NewTodo: userId is string "1" (expected number) (1 of 1 capture).](components/TodoPanel.md#req_1m9d40sdmxx) (components/TodoPanel.tsx:19)
