'use client'

import { useActionState } from 'react'
import { createProduct } from '@/actions/products'
import type { FormState } from '@/types/product'

const initialState: FormState = {}

// Form bound to a server action through useActionState; success redirects server-side.
export function CreateProductForm() {
  const [state, formAction, pending] = useActionState(createProduct, initialState)

  return (
    <form action={formAction}>
      <label>
        Name <input name="name" />
      </label>
      {state.fieldErrors?.name && <p role="alert">{state.fieldErrors.name}</p>}
      <label>
        Price <input name="price" type="number" step="0.01" />
      </label>
      {state.fieldErrors?.price && <p role="alert">{state.fieldErrors.price}</p>}
      <label>
        Stock <input name="stock" type="number" defaultValue={0} />
      </label>
      <button type="submit" disabled={pending}>
        Create
      </button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  )
}
