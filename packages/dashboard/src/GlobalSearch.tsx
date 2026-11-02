// Global search (M33): Ctrl+K / Cmd+K or `/` from any screen, arrows + Enter to open a result.
import { SEARCH_KIND_LABELS, type SearchItem, search } from '@flow-checker/shared'
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useData } from './context'
import { searchOf } from './lists'
import { href, searchScreen } from './router'
import { Badge } from './ui'

const LIMIT = 50

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const { index } = useData()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const list = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const result = useMemo(() => search(searchOf(index), q, LIMIT), [index, q])
  const items = result.items

  // Focus goes back where it was when the box closes without opening anything.
  useEffect(() => {
    const before = document.activeElement
    return () => {
      if (before instanceof HTMLElement && document.contains(before)) before.focus()
    }
  }, [])

  // A click outside the box closes it.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.target instanceof Node && !dialog.current?.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const open = (item: SearchItem | undefined) => {
    if (!item) return
    onClose()
    window.location.hash = href(searchScreen(item))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = items.length
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (n) setActive((a) => (a + 1) % n)
        break
      case 'ArrowUp':
        e.preventDefault()
        if (n) setActive((a) => (a - 1 + n) % n)
        break
      case 'Enter':
        e.preventDefault()
        open(items[active])
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
      case 'Tab':
        // The input is the only stop in the box.
        e.preventDefault()
        break
    }
  }

  const activeId = items[active] ? `${listId}-${active}` : undefined
  return (
    <div className="search-backdrop">
      <div className="search-dialog" role="dialog" aria-modal="true" aria-label="Search the app" ref={dialog}>
        <input
          className="search-input"
          type="text"
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-label="Search pages, components, requests, endpoints, types, flows and areas"
          placeholder="Search pages, components, requests, endpoints, types, flows, areas…"
          // biome-ignore lint/a11y/noAutofocus: the box opens on a shortcut to be typed in
          autoFocus
          spellCheck={false}
          autoComplete="off"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
        <div className="search-results" id={listId} role="listbox" ref={list} aria-label="Results">
          {items.map((item, i) => (
            <div
              key={`${item.kind}:${item.id}`}
              id={`${listId}-${i}`}
              role="option"
              tabIndex={-1}
              aria-selected={i === active}
              data-index={i}
              className={i === active ? 'search-result active' : 'search-result'}
              onMouseMove={() => i !== active && setActive(i)}
              onMouseDown={(e) => {
                // Keep focus in the input; open on click.
                e.preventDefault()
                if (e.button === 0) open(item)
              }}
            >
              <Badge tone={item.kind === 'page' || item.kind === 'handler' ? 'neutral' : 'muted'}>
                {SEARCH_KIND_LABELS[item.kind]}
              </Badge>
              <span className="search-label">{item.label}</span>
              {item.detail && <span className="search-detail muted">{item.detail}</span>}
            </div>
          ))}
        </div>
        <div className="search-foot muted" aria-live="polite">
          {!q.trim()
            ? 'Type a name, file, URL or path.'
            : result.total === 0
              ? 'Nothing matches.'
              : result.total > items.length
                ? `${items.length} of ${result.total} results. Keep typing to narrow them down.`
                : `${result.total} result${result.total === 1 ? '' : 's'}`}
          <span className="search-keys">
            <kbd>↑</kbd> <kbd>↓</kbd> move · <kbd>Enter</kbd> open · <kbd>Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}

/** Ctrl+K / Cmd+K toggle the box anywhere; `/` opens it when not typing in a field. */
export function useSearchShortcut(setOpen: (update: (open: boolean) => boolean) => void) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((open) => !open)
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault()
        setOpen(() => true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/** `⌘K` on Apple systems, `Ctrl K` elsewhere. */
export function shortcutLabel(): string {
  const platform = typeof navigator === 'undefined' ? '' : navigator.platform || navigator.userAgent
  return /Mac|iPhone|iPad/.test(platform) ? '⌘K' : 'Ctrl K'
}
