import { TodoPage } from '@/components/TodoPage'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TodoPage id={id} />
}
