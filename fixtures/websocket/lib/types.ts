/** Sent by the app on the ticker socket. */
export interface Subscribe {
  type: 'subscribe'
  symbols: string[]
}

/** Received on the ticker socket. */
export interface Quote {
  type: 'quote'
  symbol: string
  price: number
}

/** socket.io: sent to the app when it joins. */
export interface Joined {
  user: string
  token: string
}

/** socket.io: a chat message, as the server broadcasts it. */
export interface ChatMessage {
  id: number
  user: string
  text: string
  at: number
}

/** socket.io: what the app sends. */
export interface Draft {
  text: string
}

export interface ServerEvents {
  joined: (joined: Joined) => void
  chat: (message: ChatMessage) => void
}

export interface ClientEvents {
  chat: (draft: Draft) => void
}
