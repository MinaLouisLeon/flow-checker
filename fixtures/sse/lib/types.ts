export interface Tick {
  n: number
  at: string
}

export interface ClockStatus {
  state: 'running' | 'stopped'
  ticks: number
}

export interface Progress {
  percent: number
  step: string
}

export interface ChatRequest {
  prompt: string
}

export interface ChatChunk {
  delta: string
}

export interface ChatDone {
  tokens: number
}
