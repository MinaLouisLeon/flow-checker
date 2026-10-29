import { useState } from 'react'
import { type ExportFormat, type ExportResult, useExport } from '../api'
import { useData } from '../context'
import { Empty, Section } from '../ui'

const FORMATS: { format: ExportFormat; title: string; text: string }[] = [
  {
    format: 'md',
    title: 'Markdown docs',
    text: 'README with a route map, one page per route, component and flow (with Mermaid diagrams), all types, and the open issues. Commit them next to your code.',
  },
  {
    format: 'html',
    title: 'Static HTML site',
    text: 'This dashboard, read-only, with the scan and captures built in. One folder: open index.html or host it anywhere, no tool server needed.',
  },
]

/** Writes the docs to the folders in the config (`export.md`, `export.html`). */
export function ExportScreen() {
  const { meta } = useData()
  const run = useExport()
  const storeRaw = Boolean(meta.capture?.storeRaw)
  const [redact, setRedact] = useState(true)
  const [results, setResults] = useState<Partial<Record<ExportFormat, ExportResult>>>({})
  const [conflict, setConflict] = useState<ExportFormat | undefined>()

  if (!meta.export) {
    return (
      <div className="screen">
        <Empty>Export is available while "flow-checker" runs. You can also run "flow-checker export".</Empty>
      </div>
    )
  }
  const dirs = meta.export
  const start = (format: ExportFormat, force = false) => {
    setConflict(undefined)
    run.mutate(
      { format, raw: !redact, force },
      {
        onSuccess: (result) => setResults((current) => ({ ...current, [format]: result })),
        onError: (error) => {
          if (/--force/.test(error.message)) setConflict(format)
        },
      },
    )
  }

  return (
    <div className="screen screen-narrow">
      <h1>Export</h1>
      <p className="muted">
        Exports use the current scan with everything verified so far. Run it again after testing more of the
        app. From a terminal: <code>flow-checker export</code>.
      </p>

      <Section title="Captured data">
        <label className="export-redact">
          <input
            type="checkbox"
            checked={redact || !storeRaw}
            disabled={!storeRaw}
            onChange={(event) => setRedact(event.target.checked)}
          />{' '}
          Redact passwords, tokens and other sensitive values
        </label>
        <p className="muted">
          {storeRaw
            ? 'capture.storeRaw is on, so captures are saved unmasked. Keep this checked unless the export stays on your machine.'
            : 'Captures are saved redacted (capture.storeRaw is off), so exports are always redacted.'}
        </p>
      </Section>

      {FORMATS.map(({ format, title, text }) => {
        const result = results[format]
        return (
          <Section key={format} title={title}>
            <p>{text}</p>
            <p>
              <button type="button" className="button" disabled={run.isPending} onClick={() => start(format)}>
                {run.isPending && run.variables?.format === format ? 'Exporting…' : `Export ${title}`}
              </button>{' '}
              <span className="muted">
                to <code>{dirs[format]}</code>
              </span>
            </p>
            {result && (
              <div className={`banner ${result.redacted ? 'banner-ok' : 'banner-warn'}`}>
                Wrote {result.files} files to <code>{result.dir}</code>
                {format === 'md' ? ' (start at README.md)' : ' (open index.html)'}.
                {result.captures.included < result.captures.total &&
                  ` Includes the newest ${result.captures.included} of ${result.captures.total} captures.`}
                {!result.redacted && ' Captured data is NOT redacted: do not share it.'}
              </div>
            )}
            {run.error && run.variables?.format === format && (
              <div className="banner banner-error">
                {run.error.message}{' '}
                {conflict === format && (
                  <button type="button" className="button" onClick={() => start(format, true)}>
                    Write into it anyway
                  </button>
                )}
              </div>
            )}
          </Section>
        )
      })}
    </div>
  )
}
