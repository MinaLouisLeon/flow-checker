import { getTodo } from '@/lib/todos'
import { toggleTodo } from '../../actions'

export default async function TodoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const todo = await getTodo(id)
  return (
    <form action={toggleTodo}>
      <h1>{todo.title}</h1>
      <input type="hidden" name="id" value={todo.id} />
      <input type="hidden" name="done" value={String(!todo.done)} />
      <button type="submit">{todo.done ? 'Reopen' : 'Done'}</button>
    </form>
  )
}
