# Types

[← Overview](README.md)

6 named types, fully resolved.

## <a id="typ_1e0lnxsqglq"></a>Tick

interface · `lib/types.ts:1`

```ts
interface Tick { n: number; at: string }
```

Used by: used in [`Clock`](components/Clock.md).

## <a id="typ_0hmmneuxlns"></a>ClockStatus

interface · `lib/types.ts:6`

```ts
interface ClockStatus { state: "running" | "stopped"; ticks: number }
```

Used by: used in [`Clock`](components/Clock.md).

## <a id="typ_17hog64q8p8"></a>Progress

interface · `lib/types.ts:11`

```ts
interface Progress { percent: number; step: string }
```

Used by: used in [`JobProgress`](components/JobProgress.md).

## <a id="typ_04sa5nuyyt9"></a>ChatRequest

interface · `lib/types.ts:16`

```ts
interface ChatRequest { prompt: string }
```

Used by: request [`POST /api/chat`](components/Chat.md#req_09bcv599usy).

## <a id="typ_0xbzrh9hnrs"></a>ChatChunk

interface · `lib/types.ts:20`

```ts
interface ChatChunk { delta: string }
```

Not used by any component or request directly.

## <a id="typ_18qlraimf3z"></a>ChatDone

interface · `lib/types.ts:24`

```ts
interface ChatDone { tokens: number }
```

Not used by any component or request directly.
