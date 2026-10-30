import { AddTodoForm } from '@/components/AddTodoForm'
import { HealthBadge } from '@/components/HealthBadge'
import { TodoList } from '@/components/TodoList'

export default function HomePage() {
  return (
    <main>
      <h1>Todos</h1>
      <HealthBadge />
      <TodoList />
      <AddTodoForm />
    </main>
  )
}
