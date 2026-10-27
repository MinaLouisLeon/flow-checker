# Fixtures

Small Next.js 16 App Router apps used as scanner inputs (snapshot tests) and for end-to-end capture tests (`e2e/`). Each app has the capture hooks `flow-checker init` writes, importing the workspace build of `@integr8/flow-checker` (run `pnpm build` first). Each covers one group of patterns from docs/PLAN.md section 6.

| Fixture          | `app/` location     | Covers                                                                                                                                                                                                 |
| ---------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `basic`          | `app/` (no `src`)   | `fetch` helpers in server components, axios instance wrapper (`api.delete`), effect-triggered client fetch, event → request → `router.push`, route group `(marketing)`, dynamic `[id]`, `Pick<>` types |
| `react-query`    | `src/app/`          | `useQuery` on page load, `useMutation` with `onSuccess` invalidate + navigate, SWR, generic `http<T>()` helper, `Partial<Omit<>>` types                                                                |
| `server-actions` | `src/app/`          | `'use server'` file, `useActionState` form, direct action call in `onClick`, `redirect()` / `revalidatePath()`, `server-only`                                                                          |
| `bff`            | `src/app/`          | Route handlers (`GET`/`POST`, dynamic `[id]`) forwarding to an external API (two-hop chain), zod schemas with `z.infer` / `z.input`, 201/422 branches                                                  |
| `next-intl`      | `src/app/[locale]/` | next-intl routing, `proxy.ts`, locale-aware `Link`/`useRouter`, cross-page flow login → verify OTP → dashboard, bearer token header                                                                    |
| `mock-api`       | —                   | Dependency-free in-memory backend the apps call (port 4010)                                                                                                                                            |

## Running a fixture

```bash
node fixtures/mock-api/server.js           # terminal 1: backend on :4010
pnpm --filter @fixtures/next-intl dev      # terminal 2: app on :3000
```

To run one with capture on: `node packages/flow-checker/dist/cli.js dev --root fixtures/next-intl` (with the mock API running).

Login for `next-intl`: any mock user email (e.g. `ada@example.com`), password `password`, OTP `123456`.
