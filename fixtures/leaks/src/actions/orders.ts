'use server'

import { appendFileSync } from 'node:fs'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'

export async function archiveOrder(id: number) {
  await db.query('update orders set archived = true where id = $1', [id])
  appendFileSync('archive.log', `${id}\n`)
  revalidatePath('/')
}

export async function refreshOrders() {
  revalidatePath('/')
}
