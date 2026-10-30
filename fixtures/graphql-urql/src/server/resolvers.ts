import { createTodo, removeTodo, type TodoRecord, todos, type UserRecord, users } from './data'

// Root resolvers for `buildSchema`. Nested fields are functions (the default resolver calls them),
// and `__typename` lets the default type resolver pick the `SearchResult` member.

function userView(user: UserRecord) {
  return { __typename: 'User', ...user }
}

function todoView(todo: TodoRecord) {
  return {
    __typename: 'Todo',
    id: todo.id,
    title: todo.title,
    done: todo.done,
    status: todo.done ? 'DONE' : 'OPEN',
    owner: () => userView(users.find((user) => user.id === todo.ownerId) ?? users[0]),
  }
}

function findTodo(id: string): TodoRecord {
  const todo = todos.find((item) => item.id === id)
  if (!todo) throw new Error(`Todo ${id} not found`)
  return todo
}

export const rootValue = {
  todos: ({ status }: { status?: 'OPEN' | 'DONE' | null }) =>
    todos.filter((todo) => !status || (status === 'DONE') === todo.done).map(todoView),
  todo: ({ id }: { id: string }) => {
    const todo = todos.find((item) => item.id === id)
    return todo ? todoView(todo) : null
  },
  viewer: () => userView(users[0]),
  users: () => users.map(userView),
  search: ({ text }: { text: string }) => {
    const needle = text.toLowerCase()
    return [
      ...todos.filter((todo) => todo.title.toLowerCase().includes(needle)).map(todoView),
      ...users.filter((user) => user.name.toLowerCase().includes(needle)).map(userView),
    ]
  },
  addTodo: ({ input }: { input: { title: string; ownerId?: string | null } }) =>
    todoView(createTodo(input.title, input.ownerId ?? undefined)),
  toggleTodo: ({ id }: { id: string }) => {
    const todo = findTodo(id)
    todo.done = !todo.done
    return todoView(todo)
  },
  deleteTodo: ({ id }: { id: string }) => removeTodo(id),
}
