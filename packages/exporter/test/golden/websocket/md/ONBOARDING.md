# websocket: start here

A short tour of this Next.js 16.4.3 app, read from its code by flow-checker. [The full docs](README.md) have every page, component, request and flow.

## Stack

- Next.js: [16.4.3](README.md) (App Router in app/, 2 pages, 0 route handlers)
- Rendering: [3 server, 3 client, 0 shared](README.md) (6 components)
- Data: socket.io (1 request)
- Data: WebSocket (2 requests)

## Areas

2 areas by URL.

- home: [`/`](areas.md#ar_1vn39fso9m3) (1 page, 1 flow, 2 endpoints)
- chat: [`/chat`](areas.md#ar_19t50bf2akw) (1 page, 1 endpoint)

## Entry pages

- Start page: [`/`](pages/index.md)

## Main flows

1 flow, 0 confirmed.

- Ping click: [`/`](flows/ping-click.md) (2 steps)

## Backends

3 endpoints.

- External: [`http://localhost:4011`](endpoints.md#host-base_http___localhost_4011) (3 endpoints, 3 called from the browser)

## Where things live

- Root layout: [`app/layout.tsx`](components/RootLayout.md)
- Type: [`ChatMessage`](types.md#typ_165m1q160hg) (lib/types.ts, used 2 times)

## To check

1 open note.

- Type mismatch: [GET ws://localhost:4011/live: Received "message" doesn't match Quote: price is string "9.10" (expected number) (1 of 1 capture).](components/Ticker.md#req_0utndx9wfnl) (components/Ticker.tsx:15)
