'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { createTodo } from '@/lib/api'
import { listTodos } from '@/lib/todos'
import type { Todo } from '@/types'

export function TodoPanel() {
  const [todos, setTodos] = useState<Todo[]>([])

  useEffect(() => {
    listTodos().then(setTodos)
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const todo = await createTodo({ title: String(form.get('title')), userId: 1 })
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
        <input name="title" placeholder="New todo" />
        <button type="submit">Add</button>
      </form>
    </section>
  )
}
