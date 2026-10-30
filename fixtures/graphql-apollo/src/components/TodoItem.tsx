'use client'

import { useFragment } from '@apollo/client/react'
import Link from 'next/link'
import { type FragmentType, graphql } from '@/gql'

export const TodoItemFragment = graphql(`
  fragment TodoItem on Todo {
    id
    title
    done
  }
`)

export function TodoItem({ todo }: { todo: FragmentType<typeof TodoItemFragment> }) {
  const { data, complete } = useFragment({ fragment: TodoItemFragment, from: todo })
  if (!complete) return null
  return (
    <li>
      <Link href={`/todos/${data.id}`}>{data.title}</Link> {data.done ? '(done)' : ''}
    </li>
  )
}
