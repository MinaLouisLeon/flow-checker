# Environment variables

[← Overview](README.md)

Every `process.env` name the code reads, on which side, and which `.env` files define it. Only names are read: values never leave the `.env` files. In the browser, Next only has the names it inlined when it built the app (`NEXT_PUBLIC_` names, the `env` names in `next.config`, `NODE_ENV`).

## Names the code reads

| Name | Defined in | Read | Pages |
| --- | --- | --- | --- |
| `FLOW_CHECKER` | set by flow-checker | `src/instrumentation.ts:3` server, has a fallback<br>`src/instrumentation.ts:8` server, has a fallback | — |
| `FLOW_CHECKER_RUNTIME` | set by flow-checker | `src/instrumentation.ts:10` server | — |
| `NEXT_PUBLIC_API_URL` | **not defined** | `src/services/todos.ts:4` server and client, has a fallback | [`/`](pages/index.md), [`/settings`](pages/settings.md), [`/todos/[id]`](pages/todos.%5Bid%5D.md), [`/users`](pages/users.md) |
| `NEXT_PUBLIC_FLOW_CHECKER` | set by flow-checker | `src/instrumentation-client.ts:5` client | — |
| `NEXT_RUNTIME` | set by Next | `src/instrumentation.ts:3` server, has a fallback<br>`src/instrumentation.ts:8` server, has a fallback | — |

## Files

No `.env` file in the project root.
