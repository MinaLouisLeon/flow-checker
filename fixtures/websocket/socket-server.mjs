// Socket server for the websocket fixture (port 4011). Next.js route handlers can't accept
// WebSocket upgrades, so the app talks to this process, started next to `next dev`.
//   /live       native WebSocket, subprotocol `ticker.v1`: JSON quotes after a subscribe message
//   /echo       native WebSocket: answers text with text
//   /socket.io/ socket.io: `joined` on connect, `chat` broadcast back to everyone
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.SOCKET_PORT ?? 4011)

const http = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' }).end('ok')
    return
  }
  res.writeHead(404).end()
})

// socket.io handles /socket.io/ and must leave the other upgrades alone.
const io = new Server(http, { cors: { origin: '*' }, destroyUpgrade: false })
let nextId = 1
io.on('connection', (socket) => {
  // `token` is masked by flow-checker before the capture is saved.
  socket.emit('joined', { user: 'ada', token: 'tok_live_5f2a9c' })
  socket.on('chat', (draft) => {
    io.emit('chat', { id: nextId++, user: 'ada', text: String(draft?.text ?? ''), at: Date.now() })
  })
})

const wss = new WebSocketServer({
  noServer: true,
  handleProtocols: (protocols) => (protocols.has('ticker.v1') ? 'ticker.v1' : false),
})
http.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost')
  if (pathname !== '/live' && pathname !== '/echo') return
  wss.handleUpgrade(req, socket, head, (ws) => {
    if (pathname === '/echo') {
      ws.on('message', (data) => ws.send(`pong: ${data}`))
      return
    }
    ws.on('message', () => {
      // The third quote sends the price as text while the app's `Quote` type says number (a
      // planted type mismatch).
      const quotes = [
        { type: 'quote', symbol: 'ACME', price: 12.5 },
        { type: 'quote', symbol: 'ACME', price: 12.75 },
        { type: 'quote', symbol: 'BETA', price: '9.10' },
      ]
      quotes.forEach((quote, i) => {
        setTimeout(
          () => {
            if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(quote))
          },
          100 * (i + 1),
        )
      })
    })
  })
})

http.listen(PORT, () => console.log(`socket server on :${PORT}`))
