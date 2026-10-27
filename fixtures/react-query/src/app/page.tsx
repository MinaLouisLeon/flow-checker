import { AddTodoForm } from '@/components/AddTodoForm'
import { TodoList } from '@/components/TodoList'

export default function TodosPage() {
  return (
    <main>
      <h1>Todos</h1>
      <AddTodoForm />
      <TodoList />
    </main>
  )
}
