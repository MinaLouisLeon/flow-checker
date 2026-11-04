import 'server-only'
import { Pool } from 'pg'

// Never connects until a query runs; the fixture's pages don't run one while rendering.
export const db = new Pool({ connectionString: process.env.DATABASE_URL })
