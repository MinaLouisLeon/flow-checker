// Glossary (M34): what every status, note, trigger, transport and badge means, and what to do about
// it. The same table gives the tooltips, GLOSSARY.md and `flow-checker explain`.
import { GLOSSARY, type GlossaryGroup, glossaryTerms, termId } from '@flow-checker/shared'
import { useEffect, useMemo } from 'react'
import { replaceScreen } from '../router'
import { CodeText, Empty, SearchBox } from '../ui'

export function GlossaryScreen({ q, term }: { q: string; term?: string }) {
  const shown = useMemo(() => filterGlossary(q), [q])
  const count = shown.reduce((n, g) => n + g.keys.length, 0)

  // A link to one word scrolls to it.
  useEffect(() => {
    if (term) document.getElementById(term)?.scrollIntoView({ block: 'center' })
  }, [term])

  return (
    <div className="screen screen-narrow glossary">
      <div className="start-head">
        <h1>Glossary</h1>
        <p className="muted">
          What each status, note and badge in this dashboard means, and what to do about it. Hover a badge to
          see its line from here; <strong>Show details</strong> in the top bar shows every badge, not only the
          status.
        </p>
      </div>
      <div className="toolbar">
        <SearchBox
          value={q}
          onChange={(value) => replaceScreen({ name: 'glossary', q: value, term })}
          placeholder="Search words"
        />
      </div>
      {count === 0 ? (
        <Empty>No word matches.</Empty>
      ) : (
        shown.map(({ group, keys }) => (
          <section key={group.id} className="section" aria-labelledby={`glossary-${group.id}`}>
            <header className="section-head">
              <h2 id={`glossary-${group.id}`}>{group.title}</h2>
            </header>
            <p className="muted">{group.intro}</p>
            <dl className="glossary-list">
              {keys.map((key) => {
                const entry = group.entries[key]
                if (!entry) return null
                const id = termId(group.id, key)
                return (
                  <div key={key} id={id} className={`glossary-entry${id === term ? ' selected' : ''}`}>
                    <dt>
                      <span className="badge badge-neutral">{entry.label}</span>
                      {entry.label !== key && <code className="muted">{key}</code>}
                    </dt>
                    <dd>
                      <CodeText text={entry.means} />
                      {entry.todo && (
                        <p className="glossary-todo">
                          <strong>What to do:</strong> <CodeText text={entry.todo} />
                        </p>
                      )}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </section>
        ))
      )}
    </div>
  )
}

/** Groups with the words that match the query (key, label or text), in glossary order. */
export function filterGlossary(q: string): { group: GlossaryGroup; keys: string[] }[] {
  const query = q.trim().toLowerCase()
  const matched = new Set(
    glossaryTerms()
      .filter(
        ({ group, key, entry }) =>
          !query ||
          [key, entry.label, entry.means, entry.todo ?? '', group.title].some((f) =>
            f.toLowerCase().includes(query),
          ),
      )
      .map((t) => termId(t.group.id, t.key)),
  )
  return GLOSSARY.map((group) => ({
    group,
    keys: Object.keys(group.entries).filter((key) => matched.has(termId(group.id, key))),
  })).filter((g) => g.keys.length > 0)
}
