# Types

[← Overview](README.md)

7 named types, fully resolved.

## <a id="typ_01lxex28a31"></a>Subscribe

interface · `lib/types.ts:2`

```ts
interface Subscribe { type: "subscribe"; symbols: string[] }
```

Used by: used in [`Ticker`](components/Ticker.md).

## <a id="typ_1kri650o74u"></a>Quote

interface · `lib/types.ts:8`

```ts
interface Quote { type: "quote"; symbol: string; price: number }
```

Used by: used in [`Ticker`](components/Ticker.md).

## <a id="typ_1zt0n6v0ec6"></a>Joined

interface · `lib/types.ts:15`

```ts
interface Joined { user: string; token: string }
```

Used by: in [`ServerEvents`](#typ_0z1w2tfwh0s).

## <a id="typ_165m1q160hg"></a>ChatMessage

interface · `lib/types.ts:21`

```ts
interface ChatMessage { id: number; user: string; text: string; at: number }
```

Used by: used in [`Chat`](components/Chat.md), in [`ServerEvents`](#typ_0z1w2tfwh0s).

## <a id="typ_03lhxhb27lz"></a>Draft

interface · `lib/types.ts:29`

```ts
interface Draft { text: string }
```

Used by: in [`ClientEvents`](#typ_0m3wwrt3nt8).

## <a id="typ_0z1w2tfwh0s"></a>ServerEvents

interface · `lib/types.ts:33`

```ts
interface ServerEvents { joined: (joined: Joined) => void; chat: (message: ChatMessage) => void }
```

Used by: used in [`Chat`](components/Chat.md).

## <a id="typ_0m3wwrt3nt8"></a>ClientEvents

interface · `lib/types.ts:38`

```ts
interface ClientEvents { chat: (draft: Draft) => void }
```

Used by: used in [`Chat`](components/Chat.md).
