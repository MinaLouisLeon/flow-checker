// In-memory REST backend for the fixture apps (default http://localhost:4010).
// Routes are intentionally small but cover GET/POST/PATCH/DELETE, path params,
// query strings, auth headers, validation errors and a two-step login.
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'

const PORT = Number(process.env.MOCK_API_PORT ?? 4010)

const db = {
  users: [
    { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', role: 'admin' },
    { id: 2, name: 'Alan Turing', email: 'alan@example.com', role: 'member' },
  ],
  todos: [
    { id: 1, userId: 1, title: 'Write the first program', done: true },
    { id: 2, userId: 2, title: 'Break Enigma', done: false },
  ],
  products: [
    { id: 1, name: 'Keyboard', price: 49.9, stock: 12 },
    { id: 2, name: 'Mouse', price: 19.5, stock: 0 },
  ],
  challenges: new Map(), // challengeId -> userId
  tokens: new Map(), // token -> userId
}

const OTP_CODE = '123456'

/** @type {Array<[string, RegExp, (ctx: any) => any]>} */
const routes = [
  ['GET', /^\/users$/, () => db.users],
  ['GET', /^\/users\/(\d+)$/, ({ params }) => findOr404(db.users, params[0])],
  ['DELETE', /^\/users\/(\d+)$/, ({ params }) => remove(db.users, params[0])],

  [
    'GET',
    /^\/todos$/,
    ({ query }) => {
      const userId = query.get('userId')
      return userId ? db.todos.filter((t) => t.userId === Number(userId)) : db.todos
    },
  ],
  ['GET', /^\/todos\/(\d+)$/, ({ params }) => findOr404(db.todos, params[0])],
  [
    'POST',
    /^\/todos$/,
    ({ body }) => {
      if (!body?.title) return error(422, 'title is required')
      return create(db.todos, { userId: 1, done: false, ...body })
    },
  ],
  ['PATCH', /^\/todos\/(\d+)$/, ({ params, body }) => update(db.todos, params[0], body)],

  ['GET', /^\/products$/, () => db.products],
  ['GET', /^\/products\/(\d+)$/, ({ params }) => findOr404(db.products, params[0])],
  [
    'POST',
    /^\/products$/,
    ({ body }) => {
      if (!body?.name || typeof body.price !== 'number') return error(422, 'name and price are required')
      return create(db.products, { stock: 0, ...body })
    },
  ],
  ['DELETE', /^\/products\/(\d+)$/, ({ params }) => remove(db.products, params[0])],

  [
    'POST',
    /^\/auth\/login$/,
    ({ body }) => {
      const user = db.users.find((u) => u.email === body?.email)
      if (!user || body?.password !== 'password') return error(401, 'Invalid email or password')
      const challengeId = randomUUID()
      db.challenges.set(challengeId, user.id)
      return { otpRequired: true, challengeId }
    },
  ],
  [
    'POST',
    /^\/auth\/verify-otp$/,
    ({ body }) => {
      const userId = db.challenges.get(body?.challengeId)
      if (!userId || body?.code !== OTP_CODE) return error(400, 'Invalid or expired code')
      db.challenges.delete(body.challengeId)
      const token = randomUUID()
      db.tokens.set(token, userId)
      return { token, user: db.users.find((u) => u.id === userId) }
    },
  ],
  [
    'GET',
    /^\/me$/,
    ({ headers }) => {
      const token = headers.authorization?.replace(/^Bearer /, '')
      const userId = token && db.tokens.get(token)
      return userId ? db.users.find((u) => u.id === userId) : error(401, 'Not signed in')
    },
  ],
]

function error(status, message) {
  return { __status: status, body: { error: message } }
}
function findOr404(list, id) {
  return list.find((item) => item.id === Number(id)) ?? error(404, 'Not found')
}
function create(list, data) {
  const item = { id: Math.max(0, ...list.map((i) => i.id)) + 1, ...data }
  list.push(item)
  return { __status: 201, body: item }
}
function update(list, id, data) {
  const item = list.find((i) => i.id === Number(id))
  if (!item) return error(404, 'Not found')
  Object.assign(item, data)
  return item
}
function remove(list, id) {
  const index = list.findIndex((i) => i.id === Number(id))
  if (index === -1) return error(404, 'Not found')
  list.splice(index, 1)
  return { __status: 204, body: null }
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (chunks.length === 0) return undefined
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return undefined
  }
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()

  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  for (const [method, pattern, handler] of routes) {
    const match = req.method === method && pattern.exec(url.pathname)
    if (!match) continue
    const result = handler({
      params: match.slice(1),
      query: url.searchParams,
      headers: req.headers,
      body: await readJson(req),
    })
    const status = result?.__status ?? 200
    const body = result?.__status ? result.body : result
    if (body === null) return res.writeHead(status).end()
    res.writeHead(status, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify(body))
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: `No route for ${req.method} ${url.pathname}` }))
})

server.listen(PORT, () => {
  console.log(`mock-api listening on http://localhost:${PORT}`)
})
