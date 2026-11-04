'use client'
import { useEffect, useState } from 'react'
import type { Todo } from '@/lib/types'

export function TodoRow({ id }: { id: number }) {
  const [todo, setTodo] = useState<Todo | null>(null)
  useEffect(() => {
    fetch(`http://localhost:4010/todos/${id}?delay=30`)
      .then((res) => res.json() as Promise<Todo>)
      .then(setTodo)
  }, [id])
  return <li>{todo ? `${todo.title}${todo.done ? ' (done)' : ''}` : 'Loading...'}</li>
}
