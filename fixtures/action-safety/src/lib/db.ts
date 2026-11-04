import 'server-only'

// A tiny in-memory database with the shape of an ORM client (`db.post.create(...)`).
export interface Post {
  id: string
  title: string
  body: string
  likes: number
}

export interface User {
  id: string
  name: string
  banned: boolean
}

const posts = new Map<string, Post>([['1', { id: '1', title: 'Hello', body: 'First post', likes: 0 }]])
const users = new Map<string, User>([['u1', { id: 'u1', name: 'Ada', banned: false }]])

function table<T extends { id: string }>(rows: Map<string, T>) {
  return {
    findMany: async (where?: (row: T) => boolean) => [...rows.values()].filter(where ?? (() => true)),
    findUnique: async (id: string) => rows.get(id) ?? null,
    create: async (data: T) => {
      rows.set(data.id, data)
      return data
    },
    update: async (id: string, data: Partial<T>) => {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, ...data })
      return rows.get(id) ?? null
    },
    delete: async (id: string) => {
      rows.delete(id)
    },
  }
}

export const db = { post: table(posts), user: table(users) }
