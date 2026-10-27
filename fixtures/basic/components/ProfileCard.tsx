'use client'

import { useEffect, useState } from 'react'
import { getTodos } from '@/lib/api'
import type { Todo, User } from '@/types/user'

interface ProfileCardProps {
  user: User
}

// Client component: effect-triggered request through a fetch helper with a query string.
export function ProfileCard({ user }: ProfileCardProps) {
  const [todos, setTodos] = useState<Todo[]>([])

  useEffect(() => {
    getTodos(user.id).then(setTodos)
  }, [user.id])

  return (
    <section>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <h2>Todos</h2>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            {todo.done ? '✓' : '○'} {todo.title}
          </li>
        ))}
      </ul>
    </section>
  )
}
