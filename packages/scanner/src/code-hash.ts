// Code hash of a request site (M9, docs/PLAN.md 6.7): what has to change for captures taken
// before to be out of date. Built from the code along the call path, as tokens, so whitespace,
// comments and line numbers don't count.
import { contentHash, type RequestSite } from '@flow-checker/shared'
import { Node as N, type Node, ts } from 'ts-morph'

export interface HashFrame {
  /** The call (or JSX attribute) that enters the next function. */
  node: Node
  /** The function the call is written in. */
  scope: Node
}

/**
 * The first frame sits in the origin (a component, route handler or server action), which can
 * be large: only the part around the call counts there. Later frames are in the functions the
 * path enters (handlers, wrappers), which count as a whole.
 */
export function siteHash(
  frames: readonly HashFrame[],
  site: RequestSite,
  relFile: (n: Node) => string,
): string {
  const parts = [
    site.transport,
    site.method ?? '',
    site.url ? `${site.url.base ?? ''}${site.url.path ?? site.url.text}` : '',
    site.trigger.kind,
    site.trigger.event ?? '',
    site.hook ? `${site.hook.module}:${site.hook.name}:${site.hook.key ?? ''}` : '',
    site.serverAction?.name ?? '',
  ]
  frames.forEach((frame, i) => {
    const code = i === 0 ? originCode(frame) : frame.scope
    parts.push(relFile(code), tokens(code))
  })
  return contentHash(...parts)
}

/** Within the origin: the JSX attribute, the nearest function inside it, or the statement. */
function originCode({ node, scope }: HashFrame): Node {
  if (N.isJsxAttribute(node)) return node
  let statement: Node = node
  for (let current: Node | undefined = node; current && current !== scope; current = current.getParent()) {
    if (current !== node && N.isFunctionLikeDeclaration(current)) return current
    const parent = current.getParent()
    if (
      parent &&
      (N.isBlock(parent) || N.isSourceFile(parent)) &&
      (parent === scope || parent.getParent() === scope)
    ) {
      statement = current
    }
  }
  return statement
}

/** The node's tokens joined by spaces: the same for any formatting or comments. */
function tokens(node: Node): string {
  const file = node.getSourceFile().compilerNode
  const out: string[] = []
  const visit = (current: ts.Node) => {
    const children = current.getChildren(file)
    if (children.length > 0) {
      for (const child of children) visit(child)
      return
    }
    // Leaves are tokens (comments are trivia, so not included). JSX text keeps its words only.
    const text = current.getText(file)
    const token = current.kind === ts.SyntaxKind.JsxText ? text.replace(/\s+/g, ' ').trim() : text
    if (token) out.push(token)
  }
  visit(node.compilerNode)
  return out.join(' ')
}
