import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { getRequestListener } from '@hono/node-server'
import { type AppOptions, createApp } from './app'

export interface StartOptions extends AppOptions {
  /** Preferred port. `0` picks a free one. */
  port: number
  /** When the port is taken, try the next ones up to this many times. Default: 10. */
  portAttempts?: number
}

export interface RunningServer {
  url: string
  port: number
  close: () => Promise<void>
}

const HOST = '127.0.0.1'

/** Starts the tool server on loopback. Moves to the next port if the preferred one is in use. */
export async function startServer(options: StartOptions): Promise<RunningServer> {
  const app = createApp(options)
  const server = createServer(getRequestListener(app.fetch))
  const attempts = options.portAttempts ?? 10

  let port = options.port
  for (let attempt = 0; ; attempt++) {
    try {
      port = await listen(server, port)
      break
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'EADDRINUSE' || port === 0 || attempt + 1 >= attempts) throw error
      port += 1
    }
  }

  return {
    url: `http://localhost:${port}`,
    port,
    close: () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections()
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}

function listen(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.off('error', onError)
      resolve((server.address() as AddressInfo).port)
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, HOST)
  })
}
