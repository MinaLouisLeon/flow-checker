import type { Todo } from '@/types'

// The URL comes from the page at runtime (see app/layout.tsx), so the scan can't resolve it. The
// collection request whose name and method fit the call (`listTodos`, GET) fills it in.
function todosUrl(): string {
  return document.documentElement.dataset.todosUrl ?? ''
}

export async function listTodos(): Promise<Todo[]> {
  const res = await fetch(todosUrl())
  return res.json()
}
