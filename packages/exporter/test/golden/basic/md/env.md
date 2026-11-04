# Environment variables

[← Overview](README.md)

Every `process.env` name the code reads, on which side, and which `.env` files define it. Only names are read: values never leave the `.env` files. In the browser, Next only has the names it inlined when it built the app (`NEXT_PUBLIC_` names, the `env` names in `next.config`, `NODE_ENV`).

## Names the code reads

| Name | Defined in | Read | Pages |
| --- | --- | --- | --- |
| `FLOW_CHECKER` | set by flow-checker | `instrumentation.ts:3` server, has a fallback<br>`instrumentation.ts:8` server, has a fallback | — |
| `FLOW_CHECKER_RUNTIME` | set by flow-checker | `instrumentation.ts:10` server | — |
| `NEXT_PUBLIC_API_URL` | **not defined** | `lib/config.ts:1` server and client, has a fallback | [`/`](pages/index.md), [`/users/[id]`](pages/users.%5Bid%5D.md) |
| `NEXT_PUBLIC_FLOW_CHECKER` | set by flow-checker | `instrumentation-client.ts:5` client | — |
| `NEXT_RUNTIME` | set by Next | `instrumentation.ts:3` server, has a fallback<br>`instrumentation.ts:8` server, has a fallback | — |

## Files

No `.env` file in the project root.
