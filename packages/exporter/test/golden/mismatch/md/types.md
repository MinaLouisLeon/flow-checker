# Types

[← Overview](README.md)

4 named types, fully resolved.

## <a id="typ_2fa1fwnmo05"></a>Account

interface · `types/index.ts:5`

```ts
interface Account { id: string; name: string; email: string; avatarUrl: string }
```

Used by: request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](components/HomePage.md#req_13cmzl2vi57).

## <a id="typ_0xjkp2la9ri"></a>Settings

interface · `types/index.ts:15`

```ts
interface Settings {
  theme: "light" | "dark"
  locale: string
  digest: { frequency: "daily" | "weekly" }
}
```

Used by: used in [`SettingsPanel`](components/SettingsPanel.md), request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings`](components/SettingsPanel.md#req_23elzbn49tu).

## <a id="typ_29n1iw0u1hd"></a>Todo

interface · `types/index.ts:23`

```ts
interface Todo { id: number; userId: number; title: string; done: boolean }
```

Used by: used in [`TodoPanel`](components/TodoPanel.md), request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/TodoPanel.md#req_1a4xvnngrvj), request [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/TodoPanel.md#req_1m9d40sdmxx).

## <a id="typ_1hvhy5iwv7p"></a>NewTodo

interface · `types/index.ts:30`

```ts
interface NewTodo { title: string; userId: number }
```

Used by: request [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/TodoPanel.md#req_1m9d40sdmxx).
