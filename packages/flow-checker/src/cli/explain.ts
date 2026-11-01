// `flow-checker explain [word]` (M34): what a status, note, trigger, transport or badge means and
// what to do about it, from the same glossary as the dashboard and GLOSSARY.md.
import { CLI_NAME, findTerms, formatGlossary, type GlossaryTerm, glossaryTerms } from '@flow-checker/shared'
import type { CliIO } from './run'

export function explainCommand(words: string[], options: { json?: boolean }, io: CliIO): number {
  const word = words.join(' ').trim()
  const terms = word ? findTerms(word) : glossaryTerms()
  if (terms.length === 0) {
    io.err(`"${word}" is not in the glossary.`)
    io.err(`Run "${CLI_NAME} explain" to list every word.`)
    return 1
  }
  io.out(options.json ? JSON.stringify(terms.map(toJson), null, 2) : formatGlossary(terms))
  return 0
}

function toJson({ group, key, entry }: GlossaryTerm) {
  return { group: group.id, key, label: entry.label, means: entry.means, todo: entry.todo }
}
