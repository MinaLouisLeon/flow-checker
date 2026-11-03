import Link from 'next/link'
import { listTodos } from '@/lib/todos'
import { createTodo } from './actions'

export default async function Home() {
  const todos = await listTodos()
  return (
    <main>
      <h1>Todos</h1>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <Link href={`/todos/${todo.id}`}>{todo.title}</Link>
          </li>
        ))}
      </ul>
      <form action={createTodo}>
        <input name="title" placeholder="New todo" />
        <button type="submit">Add</button>
      </form>
    </main>
  )
}
