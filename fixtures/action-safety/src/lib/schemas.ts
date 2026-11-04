import * as v from 'valibot'
import { z } from 'zod'

export const PostSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().max(5000),
})

export const RenameSchema = v.object({
  id: v.string(),
  title: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
})
