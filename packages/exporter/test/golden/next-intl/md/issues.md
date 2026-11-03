# Issues

[← Overview](README.md)

2 open items.

## Boundary gaps (1)

Pages with nothing to show while they load, nothing to catch an error or a missing page, and slots or intercepting routes `next build` rejects.

- [`/[locale]`](pages/%5Blocale%5D.md): no not-found page: calls `notFound()` with no `not-found` file above it, so Next shows its default page (on 4 pages) (`src/app/[locale]/layout.tsx:19`)

## Flows not confirmed (1)

Inferred from the code but not walked end to end in a recorded session yet.

- [LoginForm submit](flows/loginform-submit.md): not walked yet
