// Hand-written operation types, passed to the hooks as generics.

export interface User {
  id: string
  name: string
  email: string
}

export interface TodoFields {
  id: string
  title: string
  done: boolean
}

export interface TodoDetailFields extends TodoFields {
  status: 'OPEN' | 'DONE'
  owner: Pick<User, 'id' | 'name'>
}

export interface TodosData {
  todos: TodoFields[]
}

export interface TodoData {
  todo: TodoDetailFields | null
}

export interface TodoVars {
  id: string
}

export interface AddTodoData {
  addTodo: TodoFields
}

export interface AddTodoVars {
  input: { title: string; ownerId?: string }
}

export interface DeleteTodoData {
  deleteTodo: boolean
}

export interface ViewerData {
  viewer: User
}
