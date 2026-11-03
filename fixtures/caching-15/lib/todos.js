const API_URL = process.env.API_URL ?? 'http://localhost:4010'

/** Tagged fetches in a .js helper: `todos` for the list, `todo-<id>` for each todo. */
/** @returns {Promise<import('./types').Todo[]>} */
export async function listTodos() {
  const res = await fetch(`${API_URL}/todos`, { cache: 'force-cache', next: { tags: ['todos'] } })
  return res.json()
}

/** @param {string} id @returns {Promise<import('./types').Todo>} */
export async function getTodo(id) {
  const res = await fetch(`${API_URL}/todos/${id}`, { next: { tags: ['todos', `todo-${id}`] } })
  return res.json()
}
