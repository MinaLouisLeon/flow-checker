import { TodoDetail } from '@/components/TodoDetail'

export default async function TodoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <main>
      <TodoDetail id={Number(id)} />
    </main>
  )
}
