import { TodoRow } from '@/components/todo-row'
import { getTodos } from '@/lib/api'

// Planted N+1: each row fetches its own todo in the browser.
export default async function TodosPage() {
  const todos = await getTodos()
  return (
    <ul>
      {todos.map((todo) => (
        <TodoRow key={todo.id} id={todo.id} />
      ))}
    </ul>
  )
}
