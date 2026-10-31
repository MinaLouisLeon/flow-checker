// In-memory data for the GraphQL route handler. Resets when the dev server restarts.
// Ids are unique across types (Relay normalizes records by id).

export interface UserRecord {
  id: string
  name: string
  email: string
}

export interface TodoRecord {
  id: string
  title: string
  done: boolean
  ownerId: string
}

export const users: UserRecord[] = [
  { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' },
  { id: 'u2', name: 'Grace Hopper', email: 'grace@example.com' },
  { id: 'u3', name: 'Alan Turing', email: 'alan@example.com' },
]

export const todos: TodoRecord[] = [
  { id: '1', title: 'Write the schema', done: true, ownerId: 'u1' },
  { id: '2', title: 'Add a route handler', done: false, ownerId: 'u1' },
  { id: '3', title: 'Try a persisted query', done: false, ownerId: 'u2' },
]

let nextId = todos.length + 1

export function createTodo(title: string, ownerId = 'u1'): TodoRecord {
  const todo = { id: String(nextId++), title, done: false, ownerId }
  todos.push(todo)
  return todo
}

export function removeTodo(id: string): boolean {
  const index = todos.findIndex((todo) => todo.id === id)
  if (index === -1) return false
  todos.splice(index, 1)
  return true
}
