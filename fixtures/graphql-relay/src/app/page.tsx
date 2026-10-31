import { Suspense } from 'react'
import { AddTodoForm } from '@/components/AddTodoForm'
import { ClientOnly } from '@/components/ClientOnly'
import { TodoList } from '@/components/TodoList'

export default function HomePage() {
  return (
    <main>
      <h1>Todos</h1>
      <ClientOnly fallback={<p>Loading...</p>}>
        <Suspense fallback={<p>Loading...</p>}>
          <TodoList />
        </Suspense>
      </ClientOnly>
      <AddTodoForm />
    </main>
  )
}
