# Types

[← Overview](README.md)

6 named types, fully resolved.

## <a id="typ_0ywmxvblq29"></a>DeleteUserButtonProps

interface · `components/DeleteUserButton.tsx:7`

```ts
interface DeleteUserButtonProps { userId: number }
```

Used by: props of [`DeleteUserButton`](components/DeleteUserButton.md).

## <a id="typ_12vhl9gsqi3"></a>ProfileCardProps

interface · `components/ProfileCard.tsx:7`

```ts
interface ProfileCardProps { user: User }
```

Used by: props of [`ProfileCard`](components/ProfileCard.md).

## <a id="typ_1biwb76ctp8"></a>UserListProps

interface · `components/UserList.tsx:4`

```ts
interface UserListProps { users: User[] }
```

Used by: props of [`UserList`](components/UserList.md).

## <a id="typ_243k6cp1cea"></a>Role

type-alias · `types/user.ts:1`

```ts
type Role = "admin" | "member"
```

Used by: in [`User`](#typ_0857a9l1j3p).

## <a id="typ_0857a9l1j3p"></a>User

interface · `types/user.ts:3`

```ts
interface User { id: number; name: string; email: string; role: Role }
```

Used by: request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](components/HomePage.md#req_23wds4ry0if), request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](components/UserPage.md#req_21o1or0unbb), in [`ProfileCardProps`](#typ_12vhl9gsqi3), in [`UserListProps`](#typ_1biwb76ctp8).

## <a id="typ_1tfsxfuhjes"></a>Todo

interface · `types/user.ts:10`

```ts
interface Todo { id: number; userId: number; title: string; done: boolean }
```

Used by: used in [`ProfileCard`](components/ProfileCard.md), request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos?userId=:userId`](components/ProfileCard.md#req_0h7xmjn6pcm).
