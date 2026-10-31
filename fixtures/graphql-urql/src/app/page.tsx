import { AddTodoForm } from '@/components/AddTodoForm'
import { TodoList } from '@/components/TodoList'

export default function HomePage() {
  return (
    <main>
      <h1>Open todos</h1>
      <TodoList />
      <AddTodoForm />
    </main>
  )
}
