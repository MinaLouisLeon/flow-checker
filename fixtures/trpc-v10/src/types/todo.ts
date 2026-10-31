export interface Todo {
  id: number
  userId: number
  title: string
  done: boolean
}

export interface TodoPage {
  items: Todo[]
  nextCursor: number | null
}
