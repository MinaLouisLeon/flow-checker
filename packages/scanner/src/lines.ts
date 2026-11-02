import { ts } from 'ts-morph'

/**
 * The lines (1-based) of the top-level statement around `line`: the function, component or constant a
 * line belongs to, so `flow-checker impact file:line` covers what that declaration holds. Undefined
 * when the line is outside every statement (a blank line, a comment between declarations).
 */
export function declarationLines(
  text: string,
  fileName: string,
  line: number,
): { from: number; to: number } | undefined {
  const file = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, scriptKind(fileName))
  for (const statement of file.statements) {
    const from = file.getLineAndCharacterOfPosition(statement.getStart(file)).line + 1
    const to = file.getLineAndCharacterOfPosition(statement.getEnd()).line + 1
    if (line >= from && line <= to) return { from, to }
  }
  return undefined
}

function scriptKind(fileName: string): ts.ScriptKind {
  if (/\.tsx$/.test(fileName)) return ts.ScriptKind.TSX
  if (/\.jsx$/.test(fileName)) return ts.ScriptKind.JSX
  if (/\.[cm]?js$/.test(fileName)) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}
