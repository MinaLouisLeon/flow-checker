import Link from 'next/link'

export const metadata = { title: 'Photos' }

export default function Photos() {
  return (
    <ul>
      {[1, 2, 3].map((id) => (
        <li key={id}>
          <Link href={`/photos/${id}`}>Photo {id}</Link>
        </li>
      ))}
    </ul>
  )
}
