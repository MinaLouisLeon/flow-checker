// Environment variables (M45): every name the code reads or a `.env` file defines, where each is
// read, the flags, and the files. Names only: values never leave the `.env` files.
import {
  definedText,
  ENV_FLAG_LABELS,
  envFlags,
  envFlagText,
  envOf,
  hasSource,
  unknownInClient,
  unknownText,
} from '@flow-checker/shared'
import { useData } from '../context'
import { EnvReadRow } from '../EnvView'
import { Badge, CappedList, CodeText, Empty, Section, SourceLink } from '../ui'

const MODE_LABELS = { development: 'dev', production: 'build / start', test: 'test' } as const

export function EnvScreen() {
  const { index } = useData()
  const env = envOf(index.model)
  const flagged = envFlags(env)
  const unknownClient = unknownInClient(env)
  const toCheck = flagged.length + unknownClient.length
  const read = env.vars.filter((v) => v.reads.length > 0)
  const unread = env.vars.filter((v) => v.reads.length === 0)

  return (
    <div className="screen screen-narrow">
      <h1>Environment variables</h1>
      <p className="muted">
        Every <code>process.env</code> name the code reads, on which side, and which <code>.env</code> files
        define it. Only names are read: values never leave your <code>.env</code> files. In the browser, Next
        only has the names it inlined when it built the app (<code>NEXT_PUBLIC_</code> names, the{' '}
        <code>env</code> names in <code>next.config</code>, <code>NODE_ENV</code>).
      </p>
      {env.vars.length === 0 && env.unknown.length === 0 ? (
        <Empty>The scan found no environment variables.</Empty>
      ) : (
        <>
          <p>
            {read.length} name{read.length === 1 ? '' : 's'} read · {env.files.length} <code>.env</code> file
            {env.files.length === 1 ? '' : 's'}
            {toCheck > 0 && <span className="warn"> · {toCheck} to check</span>}
          </p>

          {toCheck > 0 && (
            <Section title="To check">
              <ul className="list env-list" data-section="to-check">
                {flagged.map(({ variable, flag }) => (
                  <li key={`${variable.name}-${flag.kind}`} data-env-flag={flag.kind}>
                    <div className="cache-row">
                      <Badge tone="warn" term={['env', flag.kind]}>
                        {ENV_FLAG_LABELS[flag.kind]}
                      </Badge>
                      <code>{variable.name}</code>
                      <span className="spacer" />
                      <SourceLink file={flag.loc.file} line={flag.loc.line} column={flag.loc.column} />
                    </div>
                    <div className="muted">
                      <CodeText text={envFlagText(variable, flag.kind)} />
                    </div>
                  </li>
                ))}
                {unknownClient.map((r) => (
                  <li key={`${r.loc.file}:${r.loc.line}:${r.loc.column}`} data-env-flag="unknown-name">
                    <div className="cache-row">
                      <Badge tone="warn" term={['env', 'unknown-name']}>
                        name built at run time
                      </Badge>
                      <span className="spacer" />
                      <SourceLink file={r.loc.file} line={r.loc.line} column={r.loc.column} />
                    </div>
                    <div className="muted">
                      <CodeText text={unknownText(r)} />
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Names the code reads">
            {read.length === 0 ? (
              <Empty>No code reads a name from process.env.</Empty>
            ) : (
              <CappedList
                className="list env-list"
                items={read}
                render={(variable) => (
                  <li key={variable.name} data-env={variable.name}>
                    <div className="cache-row">
                      <code>{variable.name}</code>
                      {(variable.flags ?? []).map((f) => (
                        <Badge key={f.kind} tone="warn" term={['env', f.kind]}>
                          {ENV_FLAG_LABELS[f.kind]}
                        </Badge>
                      ))}
                      <span className="spacer" />
                      <span className={hasSource(variable) ? 'muted' : 'warn'}>
                        <CodeText text={definedText(variable)} />
                      </span>
                    </div>
                    <ul className="env-reads">
                      {variable.reads.map((r) => (
                        <EnvReadRow key={`${r.loc.file}:${r.loc.line}:${r.loc.column}`} read={r} />
                      ))}
                    </ul>
                  </li>
                )}
              />
            )}
          </Section>

          {env.unknown.length > 0 && (
            <Section title="Names built at run time">
              <p className="muted">
                <code>process.env[name]</code> with a name the code builds while it runs: the scan can't tell
                which variable these read.
              </p>
              <CappedList
                className="list env-list"
                items={env.unknown}
                render={(r) => (
                  <li key={`${r.loc.file}:${r.loc.line}:${r.loc.column}`}>
                    <div className="cache-row">
                      <code>process.env[{r.key}]</code>
                      <span className="spacer" />
                      <SourceLink file={r.loc.file} line={r.loc.line} column={r.loc.column} />
                    </div>
                  </li>
                )}
              />
            </Section>
          )}

          {unread.length > 0 && (
            <Section title="Defined but not read">
              <p className="muted">
                Names a <code>.env</code> file defines that no scanned code reads (scripts and config files
                outside the app may still use them).
              </p>
              <p data-section="unread">
                {unread.map((v, i) => (
                  <span key={v.name}>
                    {i > 0 && ', '}
                    <code>{v.name}</code>
                  </span>
                ))}
              </p>
            </Section>
          )}

          <Section title="Files">
            {env.files.length === 0 ? (
              <Empty>No .env file in the project root.</Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Loaded for</th>
                    <th>Names</th>
                  </tr>
                </thead>
                <tbody>
                  {env.files.map((f) => (
                    <tr key={f.file} data-env-file={f.file}>
                      <td>
                        <code>{f.file}</code>
                      </td>
                      <td>
                        {f.loads.length === 0 ? (
                          <span className="muted">never (Next doesn't load it)</span>
                        ) : (
                          f.loads.map((m) => MODE_LABELS[m]).join(', ')
                        )}
                      </td>
                      <td>{f.names}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </>
      )}
    </div>
  )
}
