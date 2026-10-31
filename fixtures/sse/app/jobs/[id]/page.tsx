import { JobProgress } from '@/components/JobProgress'

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <main>
      <h1>Job {id}</h1>
      <JobProgress id={id} />
    </main>
  )
}
