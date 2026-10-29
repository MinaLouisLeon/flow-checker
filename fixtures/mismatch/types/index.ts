// Some of these types disagree with what fixtures/mock-api returns, on purpose: the fixture
// checks that type comparison (M8) flags each kind of mismatch, and nothing else.

/** GET /users items. */
export interface Account {
  /** The API sends a number: wrong type. */
  id: string
  name: string
  email: string
  /** The API doesn't send it: missing field. (It sends `role`, which is not declared: extra field.) */
  avatarUrl: string
}

/** GET /settings. */
export interface Settings {
  theme: 'light' | 'dark'
  locale: string
  /** The API sends `null`: null where the type doesn't allow it. */
  digest: { frequency: 'daily' | 'weekly' }
}

/** Correct: no mismatch expected for GET /todos. */
export interface Todo {
  id: number
  userId: number
  title: string
  done: boolean
}

export interface NewTodo {
  title: string
  userId: number
}
