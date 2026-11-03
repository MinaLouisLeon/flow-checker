import { listTodos } from '@/lib/api'

export default async function DashboardPage() {
  const todos = await listTodos()
  return <h1>{todos.length} todos</h1>
}
