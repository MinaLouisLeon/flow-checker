# Environment variables

[← Overview](README.md)

Every `process.env` name the code reads, on which side, and which `.env` files define it. Only names are read: values never leave the `.env` files. In the browser, Next only has the names it inlined when it built the app (`NEXT_PUBLIC_` names, the `env` names in `next.config`, `NODE_ENV`).

## Names the code reads

| Name | Defined in | Read | Pages |
| --- | --- | --- | --- |
| `FLOW_CHECKER` | set by flow-checker | `src/instrumentation.ts:3` server, has a fallback<br>`src/instrumentation.ts:8` server, has a fallback | — |
| `FLOW_CHECKER_RUNTIME` | set by flow-checker | `src/instrumentation.ts:10` server | — |
| `NEXT_PUBLIC_API_URL` | **not defined** | `src/lib/auth-api.ts:3` client, has a fallback | [`/[locale]/dashboard`](pages/%5Blocale%5D.dashboard.md), [`/[locale]/login`](pages/%5Blocale%5D.login.md), [`/[locale]/verify`](pages/%5Blocale%5D.verify.md) |
| `NEXT_PUBLIC_FLOW_CHECKER` | set by flow-checker | `src/instrumentation-client.ts:5` client | — |
| `NEXT_RUNTIME` | set by Next | `src/instrumentation.ts:3` server, has a fallback<br>`src/instrumentation.ts:8` server, has a fallback | — |

## Files

No `.env` file in the project root.
