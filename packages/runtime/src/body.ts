// Turns request and response bodies into `CapturedBody`, limited to `maxBodyBytes`.
// Works in the browser and in Node (only uses web platform APIs).
import type { CapturedBody } from '@flow-checker/shared'

const encoder = new TextEncoder()

export function byteLength(text: string): number {
  return encoder.encode(text).length
}

/** Content types whose body is read as text. Everything else is kept as `binary`. */
export function isTextual(contentType: string | undefined): boolean {
  if (!contentType) return true
  const type = contentType.toLowerCase()
  return (
    type.startsWith('text/') ||
    type.includes('json') ||
    type.includes('xml') ||
    type.includes('javascript') ||
    type.includes('x-www-form-urlencoded') ||
    type.includes('x-component')
  )
}

/** Parses text by content type: JSON, url-encoded form, or plain text. */
export function textBody(text: string, contentType: string | undefined, maxBytes: number): CapturedBody {
  if (text.length === 0) return { kind: 'none' }
  const size = byteLength(text)
  if (size > maxBytes) {
    return { kind: 'text', value: text.slice(0, maxBytes), size, truncated: true }
  }
  const type = contentType?.toLowerCase() ?? ''
  if (type.includes('x-www-form-urlencoded')) return formBody(new URLSearchParams(text))
  const trimmed = text.trimStart()
  if (type.includes('json') || ((!type || type.startsWith('text/plain')) && /^[[{]/.test(trimmed))) {
    try {
      return { kind: 'json', value: JSON.parse(text), size }
    } catch {
      // Not JSON after all.
    }
  }
  return { kind: 'text', value: text, size }
}

export function formBody(entries: Iterable<[string, unknown]>): CapturedBody {
  const value: Record<string, string | string[]> = {}
  for (const [key, raw] of entries) {
    const text = describeFormValue(raw)
    const existing = value[key]
    if (existing === undefined) value[key] = text
    else value[key] = Array.isArray(existing) ? [...existing, text] : [existing, text]
  }
  return { kind: 'form', value }
}

function describeFormValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    const name = (value as Blob & { name?: string }).name
    return `[file${name ? ` ${name}` : ''}, ${value.size} bytes]`
  }
  return String(value)
}

/**
 * Describes a fetch/XHR request body without consuming it. Streams and Request
 * bodies are not read here (see `readRequestBody`).
 */
export function requestBody(body: unknown, contentType: string | undefined, maxBytes: number): CapturedBody {
  try {
    if (body === undefined || body === null) return { kind: 'none' }
    if (typeof body === 'string') return textBody(body, contentType, maxBytes)
    if (body instanceof URLSearchParams) return formBody(body.entries())
    if (typeof FormData !== 'undefined' && body instanceof FormData) return formBody(body.entries())
    if (typeof Blob !== 'undefined' && body instanceof Blob) {
      return { kind: 'binary', contentType: body.type || contentType, size: body.size }
    }
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
      const bytes =
        body instanceof ArrayBuffer
          ? new Uint8Array(body)
          : new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
      if (isTextual(contentType) && contentType) {
        return textBody(new TextDecoder().decode(bytes.subarray(0, maxBytes + 1)), contentType, maxBytes)
      }
      return { kind: 'binary', contentType, size: bytes.byteLength }
    }
    if (typeof Document !== 'undefined' && body instanceof Document) {
      return { kind: 'text', value: '[document]' }
    }
    return { kind: 'binary', contentType }
  } catch {
    return { kind: 'binary', contentType }
  }
}

/** Reads a (cloned) body stream up to `maxBytes`, then cancels it. */
export async function readStream(
  stream: ReadableStream<Uint8Array> | null,
  contentType: string | undefined,
  maxBytes: number,
  declaredSize?: number,
): Promise<CapturedBody> {
  if (!stream) return { kind: 'none' }
  const type = contentType?.toLowerCase() ?? ''
  if (!isTextual(contentType) || type.includes('event-stream')) {
    await stream.cancel().catch(() => {})
    return { kind: 'binary', contentType, size: declaredSize }
  }
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let truncated = false
  try {
    for (;;) {
      let next: ReadableStreamReadResult<Uint8Array>
      try {
        next = await reader.read()
      } catch (error) {
        // The app aborted the request after reading what it needed (tRPC's stream link does
        // this once every result is in). Keep what arrived, marked as cut short.
        if (total === 0) throw error
        truncated = true
        break
      }
      if (next.done) break
      chunks.push(next.value)
      total += next.value.byteLength
      if (total > maxBytes) {
        truncated = true
        await reader.cancel().catch(() => {})
        break
      }
    }
  } finally {
    reader.releaseLock?.()
  }
  return bytesBody(chunks, total, contentType, maxBytes, truncated ? (declaredSize ?? total) : undefined)
}

/** Builds a body from collected chunks. `truncatedSize` is set when reading stopped early. */
export function bytesBody(
  chunks: Uint8Array[],
  total: number,
  contentType: string | undefined,
  maxBytes: number,
  truncatedSize?: number,
): CapturedBody {
  if (!isTextual(contentType)) return { kind: 'binary', contentType, size: total }
  const all = new Uint8Array(Math.min(total, maxBytes))
  let offset = 0
  for (const chunk of chunks) {
    if (offset >= all.length) break
    const part = chunk.subarray(0, all.length - offset)
    all.set(part, offset)
    offset += part.length
  }
  const text = new TextDecoder().decode(all)
  if (truncatedSize !== undefined || total > maxBytes) {
    return { kind: 'text', value: text, size: truncatedSize ?? total, truncated: true }
  }
  return textBody(text, contentType, maxBytes)
}

/** Lower-cased plain object from any headers shape. */
export function headersToObject(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    if (!headers) return out
    if (typeof Headers !== 'undefined' && headers instanceof Headers) {
      headers.forEach((value, key) => {
        out[key.toLowerCase()] = value
      })
      return out
    }
    if (Array.isArray(headers)) {
      for (const [key, value] of headers as [string, string][]) out[String(key).toLowerCase()] = String(value)
      return out
    }
    if (typeof headers === 'object') {
      for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
        if (value === undefined) continue
        out[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value)
      }
    }
  } catch {
    // Unknown headers shape: keep what we have.
  }
  return out
}

/** Stack frames below the runtime's own frames, innermost first. */
export function callerStack(skip: RegExp): string[] {
  const stack = new Error().stack ?? ''
  return stack
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line && !skip.test(line))
    .slice(0, 20)
}
