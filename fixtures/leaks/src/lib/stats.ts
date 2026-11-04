import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function countOrders(): Promise<number> {
  const result = await pool.query('select count(*) from orders')
  return Number(result.rows[0]?.count ?? 0)
}
