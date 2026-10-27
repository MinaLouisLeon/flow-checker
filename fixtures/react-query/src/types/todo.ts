export interface Todo {
  id: number
  userId: number
  title: string
  done: boolean
}

export type NewTodo = Pick<Todo, 'title'>

export type TodoPatch = Partial<Omit<Todo, 'id' | 'userId'>>
