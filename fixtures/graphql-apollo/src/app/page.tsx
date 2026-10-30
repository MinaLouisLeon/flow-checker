import { AddTodoForm } from '@/components/AddTodoForm'
import { TodoList } from '@/components/TodoList'
import { ViewerBadge } from '@/components/ViewerBadge'

export default function HomePage() {
  return (
    <main>
      <h1>Todos</h1>
      <ViewerBadge />
      <TodoList />
      <AddTodoForm />
    </main>
  )
}
