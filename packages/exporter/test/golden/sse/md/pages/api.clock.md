# Route handler `/api/clock`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/api/clock/route.ts` |
| Methods | GET |

## Event stream (GET)

| Event | Data | Where |
| --- | --- | --- |
| `tick` | `Tick` | `app/api/clock/route.ts:18` |
| `message` | `ClockStatus` | `app/api/clock/route.ts:23` |
| `done` | `{ ok: boolean; }` | `app/api/clock/route.ts:24` |

**`tick`** [`Tick`](../types.md#typ_1e0lnxsqglq)

```ts
{ n: number; at: string }
```

**`message`** [`ClockStatus`](../types.md#typ_0hmmneuxlns)

```ts
{ state: "running" | "stopped"; ticks: number }
```

**`done`** `{ ok: boolean; }`

```ts
{ ok: boolean }
```

## Called by

| Request | From | Status |
| --- | --- | --- |
| [`GET /api/clock?count=3`](../components/Clock.md#req_1iv9ud7bbfd) | [`Clock`](../components/Clock.md) | ✓ verified (2 captures) |

## Requests it sends

None found.
