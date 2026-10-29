'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { createTodo, getTodos } from '@/lib/api'
import type { Todo } from '@/types'

// GET /todos matches `Todo[]`. The form sends `userId` as the input's string, although
// `NewTodo` says number (a common bug the type comparison catches); the API echoes it back.
export function TodoPanel() {
  const [todos, setTodos] = useState<Todo[]>([])

  useEffect(() => {
    getTodos().then(setTodos)
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const todo = await createTodo({
      title: String(form.get('title')),
      userId: form.get('userId') as unknown as number,
    })
    setTodos((list) => [...list, todo])
  }

  return (
    <section>
      <h2>Todos</h2>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
      <form onSubmit={onSubmit}>
        <input type="hidden" name="userId" value="1" />
        <input name="title" placeholder="New todo" />
        <button type="submit">Add</button>
      </form>
    </section>
  )
}
