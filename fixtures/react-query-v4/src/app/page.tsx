import { AddTodoForm } from '@/components/AddTodoForm'
import { TodoList } from '@/components/TodoList'
import { TodoStats } from '@/components/TodoStats'

export default function TodosPage() {
  return (
    <main>
      <h1>Todos</h1>
      <AddTodoForm />
      <TodoList />
      <TodoStats />
    </main>
  )
}
