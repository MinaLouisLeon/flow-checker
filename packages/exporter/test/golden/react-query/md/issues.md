# Issues

[← Overview](README.md)

6 open items.

## Captures without a request site (2)

No scanned request site fits these (unmatched), or several fit equally well (ambiguous). Unmatched requests usually point at code the scanner missed. Assign them in the dashboard's Live screen.

| Time | Request | Status | Page | Match |
| --- | --- | --- | --- | --- |
| 2026-10-31 22:51 UTC | `GET http://localhost:4010/users/2` | 200 | `/users` | ambiguous |
| 2026-10-31 22:51 UTC | `GET http://localhost:4010/users/1` | 200 | `/users` | ambiguous |

## Flows not confirmed (4)

Inferred from the code but not walked end to end in a recorded session yet.

- [AddTodoForm submit](flows/addtodoform-submit.md): not walked yet
- [TodoList change](flows/todolist-change.md): not walked yet
- [UserList mouseenter](flows/userlist-mouseenter.md): not walked yet
- [UserList click](flows/userlist-click.md): not walked yet
