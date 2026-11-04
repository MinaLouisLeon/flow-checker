let drafts = 3

export async function DELETE() {
  drafts = 0
  return Response.json({ drafts })
}
