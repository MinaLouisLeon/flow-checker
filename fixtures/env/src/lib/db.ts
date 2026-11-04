// Planted: no .env file defines DATABASE_URL and nothing falls back.
const pool = { connectionString: process.env.DATABASE_URL as string, max: 5 }

export function connectionLabel(): string {
  return `pool of ${pool.max}`
}
