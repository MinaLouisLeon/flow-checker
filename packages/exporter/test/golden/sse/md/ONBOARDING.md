# sse: start here

A short tour of this Next.js 16.4.3 app, read from its code by flow-checker. [The full docs](README.md) have every page, component, request and flow.

## Stack

- Next.js: [16.4.3](README.md) (App Router in app/, 3 pages, 3 route handlers)
- Rendering: [4 server, 3 client, 0 shared](README.md) (7 components)
- Data: Event streams (SSE) (3 requests)

## Areas

3 areas by URL.

- home: [`/`](areas.md#ar_1vn39fso9m3) (1 page, 1 endpoint)
- chat: [`/chat`](areas.md#ar_19t50bf2akw) (1 page, 1 flow, 1 endpoint)
- jobs: [`/jobs`](areas.md#ar_0dcdhr9zs9y) (1 page, 1 flow, 1 endpoint)

## Entry pages

- Start page: [`/`](pages/index.md)

## Main flows

2 flows, 0 confirmed.

- Chat submit: [`/chat`](flows/chat-submit.md) (2 steps)
- JobProgress click: [`/jobs/[id]`](flows/jobprogress-click.md) (2 steps)

## Backends

3 endpoints.

- This app: [This app's API](endpoints.md#host-app) (3 endpoints, 3 called from the browser)

## Where things live

- Root layout: [`app/layout.tsx`](components/RootLayout.md)
- Route handlers: [`app/api/`](README.md) (3 handlers)

## To check

1 open note.

- Type mismatch: [GET /api/jobs/:id/progress: Event "progress" doesn't match Progress: percent is string "25%" (expected number) (1 of 1 capture).](components/JobProgress.md#req_2efgv3zloxh) (components/JobProgress.tsx:17)
