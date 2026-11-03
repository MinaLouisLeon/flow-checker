import { Modal } from '@/components/modal'

export default async function PhotoModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <Modal>Photo {id}</Modal>
}
