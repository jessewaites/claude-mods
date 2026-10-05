import type { ClientElements, ClientKeyEvent, ClientModule } from 'claude-code'

import type { EditorMessage, EditorProps } from '../types/index.d.ts'
import { languageFor, tokenize } from './highlight.ts'
import type { Line, Style } from './highlight.ts'

type Snap = { lines: string[]; row: number; col: number }

type State = {
  lines: string[]
  row: number
  col: number
  top: number
  left: number
  undo: Snap[]
  redo: Snap[]
  /** 'type' while consecutive characters are typed, so one ctrl+z removes the word. */
  group: 'type' | null
  /** The `request.n` from props already acted on. */
  handled: number
  /** The find bar: `open` while keys go to the query; the query outlives a close. */
  find: { open: boolean; query: string }
  /** The `props.text` the lines were loaded from, so a new text on disk is told from an edit here. */
  base: string
}

type Pos = { row: number; col: number }

const TAB = '    '
const HISTORY = 300
const expand = (line: string) => line.replace(/\t/g, TAB)
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

const fresh = (text: string, handled: number): State => ({
  lines: text.split('\n'),
  row: 0,
  col: 0,
  top: 0,
  left: 0,
  undo: [],
  redo: [],
  group: null,
  handled,
  find: { open: false, query: '' },
  base: text,
})

/**
 * The first match of `query` from `from` in direction `dir`, the start
 * position included, wrapping round the file; null when the file has none.
 */
const findFrom = (lines: string[], query: string, from: Pos, dir: 1 | -1): Pos | null => {
  const needle = query.toLowerCase()
  if (!needle) return null
  const n = lines.length
  for (let k = 0; k <= n; k++) {
    const row = (((from.row + dir * k) % n) + n) % n
    const hay = (lines[row] ?? '').toLowerCase()
    if (dir === 1) {
      const i = hay.indexOf(needle, k === 0 ? from.col : 0)
      if (i >= 0 && (k < n || i < from.col)) return { row, col: i }
    } else {
      const start = k === 0 ? from.col : hay.length
      if (start < 0) continue
      const i = hay.lastIndexOf(needle, start)
      if (i >= 0 && (k < n || i > from.col)) return { row, col: i }
    }
  }
  return null
}

/** Every start index of `query` in `line`, case-insensitively. */
const occurrences = (line: string, query: string) => {
  const out: number[] = []
  const needle = query.toLowerCase()
  if (!needle) return out
  const hay = line.toLowerCase()
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + Math.max(1, needle.length))) out.push(i)
  return out
}

const countMatches = (lines: string[], query: string) => lines.reduce((n, line) => n + occurrences(line, query).length, 0)

/** Keeps the cursor inside the window; pure. */
const scrolled = (st: State, rows: number, cols: number): State => {
  let { top, left } = st
  if (st.row < top) top = st.row
  if (st.row >= top + rows) top = st.row - rows + 1
  const dispCol = expand((st.lines[st.row] ?? '').slice(0, st.col)).length
  if (dispCol < left) left = dispCol
  if (dispCol >= left + cols) left = dispCol - cols + 1
  return { ...st, top: Math.max(0, top), left: Math.max(0, left) }
}

const isPrintable = (ev: ClientKeyEvent) =>
  !ev.ctrl && !ev.meta && ev.key.length >= 1 && ev.key.length <= 2 && !/[\u0000-\u001f\u007f]/.test(ev.key)

/** One cursor move or edit; undefined when the key means nothing here. */
const apply = (st: State, ev: ClientKeyEvent, rows: number): State | undefined => {
  const lines = st.lines.slice()
  let { row, col } = st
  const line = lines[row] ?? ''
  const at = (i: number) => lines[i] ?? ''
  const key = ev.key

  if (ev.ctrl || ev.meta) {
    if (key === 'a' && ev.ctrl) return { ...st, col: 0 }
    if (key === 'e' && ev.ctrl) return { ...st, col: line.length }
    return undefined
  }

  switch (key) {
    case 'up':
      if (row === 0) return { ...st, col: 0 }
      row--
      return { ...st, row, col: Math.min(col, at(row).length) }
    case 'down':
      if (row === lines.length - 1) return { ...st, col: line.length }
      row++
      return { ...st, row, col: Math.min(col, at(row).length) }
    case 'left':
      if (col > 0) return { ...st, col: col - 1 }
      if (row > 0) return { ...st, row: row - 1, col: at(row - 1).length }
      return st
    case 'right':
      if (col < line.length) return { ...st, col: col + 1 }
      if (row < lines.length - 1) return { ...st, row: row + 1, col: 0 }
      return st
    case 'home':
      return { ...st, col: 0 }
    case 'end':
      return { ...st, col: line.length }
    case 'pageup':
      row = clamp(row - rows, 0, lines.length - 1)
      return { ...st, row, col: Math.min(col, at(row).length) }
    case 'pagedown':
      row = clamp(row + rows, 0, lines.length - 1)
      return { ...st, row, col: Math.min(col, at(row).length) }
    case 'return': {
      const indent = /^[ \t]*/.exec(line)?.[0] ?? ''
      lines.splice(row, 1, line.slice(0, col), indent + line.slice(col))
      return { ...st, lines, row: row + 1, col: indent.length }
    }
    case 'backspace':
      if (col > 0) {
        lines[row] = line.slice(0, col - 1) + line.slice(col)
        return { ...st, lines, col: col - 1 }
      }
      if (row > 0) {
        const prev = at(row - 1)
        lines.splice(row - 1, 2, prev + line)
        return { ...st, lines, row: row - 1, col: prev.length }
      }
      return st
    case 'delete':
      if (col < line.length) {
        lines[row] = line.slice(0, col) + line.slice(col + 1)
        return { ...st, lines }
      }
      if (row < lines.length - 1) {
        lines.splice(row, 2, line + at(row + 1))
        return { ...st, lines }
      }
      return st
    case 'tab':
      lines[row] = line.slice(0, col) + TAB + line.slice(col)
      return { ...st, lines, col: col + TAB.length }
    default:
      break
  }

  if (isPrintable(ev)) {
    lines[row] = line.slice(0, col) + key + line.slice(col)
    return { ...st, lines, col: col + key.length }
  }
  return undefined
}

/** The real column whose expanded (tab-widened) width first reaches `display`. */
const colAtDisplay = (line: string, display: number) => {
  let width = 0
  for (let i = 0; i < line.length; i++) {
    const w = line[i] === '\t' ? TAB.length : 1
    if (display < width + w) return i
    width += w
  }
  return line.length
}

const snap = (st: State): Snap => ({ lines: st.lines, row: st.row, col: st.col })

const restore = (st: State, s: Snap): State => ({
  ...st,
  lines: s.lines,
  row: clamp(s.row, 0, s.lines.length - 1),
  col: clamp(s.col, 0, (s.lines[clamp(s.row, 0, s.lines.length - 1)] ?? '').length),
  group: null,
})

/** Lines are tokenized in blocks of this many, so a scroll re-tokenizes rarely. */
const HL_BLOCK = 200

type Highlighted = { path: string; lines: string[]; upto: number; language: string | null; out: Line[] }
/** The last tokenization, reused while the text, the file and the window all match. */
let highlighted: Highlighted | null = null

/**
 * Tokens for the first `upto` lines of `lines`: highlight.js has no public
 * continuation, so the prefix through the visible window is tokenized whole,
 * and only again when the text changes or the window moves past it.
 * `null` when the file's language is unknown (drawn plain).
 */
const tokensFor = (path: string, lines: string[], upto: number): Line[] | null => {
  const want = Math.min(lines.length, Math.ceil(upto / HL_BLOCK) * HL_BLOCK)
  const hit = highlighted
  if (hit && hit.path === path && hit.lines === lines && hit.upto >= want) return hit.language ? hit.out : null
  const language = hit && hit.path === path ? hit.language : languageFor(path, lines[0] ?? '')
  const out = language ? tokenize(lines.slice(0, want).join('\n'), language) : []
  highlighted = { path, lines, upto: want, language, out }
  return language ? out : null
}

type Paint = { color?: string; backgroundColor?: string; bold?: boolean; italic?: boolean; dimColor?: boolean; underline?: boolean }
const textProps = (style: Style | null): Paint =>
  style ? { color: style.color, bold: style.bold, italic: style.italic, dimColor: style.dim, underline: style.underline } : {}

type Seg = { text: string; style: Style | null; from: number }

/**
 * The visible cells of one line, columns `left` to `left + cols` after tab
 * expansion, as styled Texts: the cell at display column `cursor` inverted,
 * the display ranges in `marks` (find matches) on a yellow ground.
 */
const drawLine = (Text: ClientElements['Text'], tokens: Line, left: number, cols: number, cursor: number | null, marks: Array<[number, number]>) => {
  const end = left + cols

  // The tokens clipped to the window, in absolute display columns.
  const segs: Seg[] = []
  let at = 0
  for (const token of tokens) {
    const text = expand(token.text)
    const from = at
    at += text.length
    if (at <= left || from >= end) continue
    const a = Math.max(from, left)
    const b = Math.min(at, end)
    segs.push({ text: text.slice(a - from, b - from), style: token.style, from: a })
  }

  // Split where the cursor or a mark begins or ends, so each piece has one look.
  const cuts: number[] = []
  if (cursor !== null) cuts.push(cursor, cursor + 1)
  for (const [a, b] of marks) cuts.push(a, b)
  const split: Seg[] = []
  for (const seg of segs) {
    let start = seg.from
    const stop = seg.from + seg.text.length
    for (const c of [...new Set(cuts)].filter(c => c > start && c < stop).sort((x, y) => x - y)) {
      split.push({ text: seg.text.slice(start - seg.from, c - seg.from), style: seg.style, from: start })
      start = c
    }
    split.push({ text: seg.text.slice(start - seg.from), style: seg.style, from: start })
  }

  const out = []
  for (const seg of split) {
    if (!seg.text) continue
    const paint = textProps(seg.style)
    if (marks.some(([a, b]) => seg.from >= a && seg.from < b)) {
      paint.backgroundColor = 'yellow'
      paint.color = 'black'
      paint.dimColor = false
    }
    out.push(
      <Text {...paint} inverse={cursor !== null && seg.from === cursor ? true : undefined}>
        {seg.text}
      </Text>,
    )
  }
  // A cursor past the end of the line (or on an empty one) sits on a blank cell.
  if (cursor !== null && cursor >= Math.max(at, left) && cursor < end) out.push(<Text inverse> </Text>)
  return out
}

const Editor: ClientModule<EditorProps, State> = (props, surface) => {
  const { Box, Text } = surface.elements

  const post = (msg: EditorMessage) => surface.post(msg)

  /** Stores the state and hands the pane the new text, so its buttons can save it. */
  const commit = (before: State, after: State) => {
    surface.setState(after)
    if (after.lines !== before.lines) post({ type: 'draft', path: props.path, text: after.lines.join('\n') })
  }

  if (surface.state === undefined) {
    surface.setState(fresh(props.text, props.request?.n ?? 0))
    surface.onKey(raw => {
      // The space bar arrives under its name on some surfaces; the editor wants the character.
      const ev: ClientKeyEvent = raw.key === 'space' ? { ...raw, key: ' ' } : raw
      let st = surface.state
      if (!st) return
      const bodyRows = Math.max(1, surface.rows - 1)
      const gutter = String(st.lines.length).length + 1
      const bodyCols = Math.max(10, surface.columns - gutter)

      if (ev.ctrl && ev.key === 's') {
        post({ type: 'save', path: props.path, text: st.lines.join('\n') })
        return surface.setState({ ...st, group: null })
      }
      if (ev.ctrl && (ev.key === 'z' || ev.key === 'u') && !ev.shift) {
        const prev = st.undo[st.undo.length - 1]
        if (!prev) return
        return commit(st, scrolled(restore({ ...st, undo: st.undo.slice(0, -1), redo: [...st.redo, snap(st)] }, prev), bodyRows, bodyCols))
      }
      if (ev.ctrl && (ev.key === 'y' || (ev.key === 'z' && ev.shift))) {
        const nxt = st.redo[st.redo.length - 1]
        if (!nxt) return
        return commit(st, scrolled(restore({ ...st, redo: st.redo.slice(0, -1), undo: [...st.undo, snap(st)] }, nxt), bodyRows, bodyCols))
      }

      // Find: ctrl+f opens the bar (and closes it again); while open, typing edits
      // the query and jumps to its first match from the cursor, Enter or ↓ goes to
      // the next, ↑ to the previous, Tab closes. Other movement keys close it and
      // act on the text. ctrl+g repeats the last search with the bar closed.
      const jump = (to: Pos | null, find: State['find']) => {
        if (!st) return
        const at = to ?? { row: st.row, col: st.col }
        surface.setState(scrolled({ ...st, row: at.row, col: at.col, find, group: null }, bodyRows, bodyCols))
      }
      if (ev.ctrl && ev.key === 'f') return jump(null, { ...st.find, open: !st.find.open })
      if (ev.ctrl && ev.key === 'g') return jump(findFrom(st.lines, st.find.query, { row: st.row, col: st.col + 1 }, 1), st.find)
      if (st.find.open) {
        const { query } = st.find
        if (ev.key === 'return' || ev.key === 'down') return jump(findFrom(st.lines, query, { row: st.row, col: st.col + 1 }, 1), st.find)
        if (ev.key === 'up') return jump(findFrom(st.lines, query, { row: st.row, col: st.col - 1 }, -1), st.find)
        if (ev.key === 'tab') return jump(null, { ...st.find, open: false })
        if (ev.key === 'backspace' || isPrintable(ev)) {
          const next = ev.key === 'backspace' ? query.slice(0, -1) : query + ev.key
          return jump(findFrom(st.lines, next, { row: st.row, col: st.col }, 1), { open: true, query: next })
        }
        if (!ev.ctrl && !ev.meta) st = { ...st, find: { ...st.find, open: false } }
      }

      const moved = apply(st, ev, bodyRows)
      if (!moved || moved === st) return
      const edited = moved.lines !== st.lines
      let next = moved
      if (edited) {
        const typing = isPrintable(ev)
        const keep = typing && st.group === 'type'
        next = {
          ...moved,
          undo: keep ? st.undo : [...st.undo, snap(st)].slice(-HISTORY),
          redo: [],
          group: typing ? 'type' : null,
        }
      } else {
        next = { ...moved, group: null }
      }
      commit(st, scrolled(next, bodyRows, bodyCols))
    })

    // A left click drops the cursor on the cell under the pointer.
    surface.onPointer(ev => {
      const st = surface.state
      if (!st || ev.type !== 'down' || ev.button !== 'left') return
      const bodyRows = Math.max(1, surface.rows - 1)
      const gutter = String(st.lines.length).length + 1
      const bodyCols = Math.max(10, surface.columns - gutter)
      const view = scrolled(st, bodyRows, bodyCols)
      const row = clamp(view.top + ev.y, 0, st.lines.length - 1)
      if (ev.y >= bodyRows) return
      const display = Math.max(0, view.left + ev.x - gutter)
      const col = colAtDisplay(st.lines[row] ?? '', display)
      surface.setState({ ...view, row, col, group: null })
    })
  }

  let st = surface.state ?? fresh(props.text, props.request?.n ?? 0)

  // A new text from the pane (a refresh, or Claude editing the file on disk)
  // replaces a clean buffer; a buffer with edits keeps them, and only notes
  // the saved text once it matches again.
  if (props.text !== st.base) {
    const joined = st.lines.join('\n')
    if (joined === st.base) {
      const reloaded: State = { ...fresh(props.text, st.handled), find: st.find }
      surface.setState(reloaded)
      st = reloaded
    } else if (joined === props.text) {
      const synced: State = { ...st, base: props.text }
      surface.setState(synced)
      st = synced
    }
  }

  const bodyRows = Math.max(1, surface.rows - 1)
  const gutter = String(st.lines.length).length + 1
  const bodyCols = Math.max(10, surface.columns - gutter)

  // Asks from the pane, each seen once by its `n`. A revert: the hooks module
  // already dropped the draft, so this only resets the lines (undoable). A
  // scroll (the wheel over the editor): the window moves and the cursor stays
  // inside it, so the draw below does not pull the window back.
  if (props.request && props.request.n !== st.handled) {
    let next: State
    if (props.request.kind === 'revert') {
      next = { ...fresh(props.text, props.request.n), undo: [...st.undo, snap(st)].slice(-HISTORY), find: st.find }
    } else {
      const top = clamp(st.top + props.request.by, 0, Math.max(0, st.lines.length - bodyRows))
      const row = clamp(st.row, top, Math.min(st.lines.length - 1, top + bodyRows - 1))
      next = { ...st, top, row, col: Math.min(st.col, (st.lines[row] ?? '').length), handled: props.request.n, group: null }
    }
    surface.setState(next)
    st = next
  }

  const dirty = st.lines.join('\n') !== props.text
  const view = scrolled(st, bodyRows, bodyCols)

  const tokens = tokensFor(props.path, st.lines, Math.min(st.lines.length, view.top + bodyRows))
  const language = highlighted?.language ?? null

  const drawn = []
  for (let i = view.top; i < Math.min(st.lines.length, view.top + bodyRows); i++) {
    const num = String(i + 1).padStart(gutter - 1, ' ') + ' '
    const raw = st.lines[i] ?? ''
    const line: Line = tokens?.[i] ?? (raw ? [{ text: raw, style: null }] : [])
    const cursor = i === st.row ? expand(raw.slice(0, st.col)).length : null
    const marks: Array<[number, number]> = occurrences(raw, st.find.query).map(c => [
      expand(raw.slice(0, c)).length,
      expand(raw.slice(0, c + st.find.query.length)).length,
    ])
    drawn.push(
      <Box flexDirection="row">
        <Text dimColor>{num}</Text>
        {drawLine(Text, line, view.left, bodyCols, cursor, marks)}
      </Box>,
    )
  }

  const where = `Ln ${st.row + 1}, Col ${st.col + 1}`
  const status = st.find.open ? (
    <Box flexDirection="row">
      <Text color="yellow" wrap="truncate-end">
        {`find: ${st.find.query}▏`}
      </Text>
      <Text dimColor wrap="truncate-end">
        {` ${st.find.query ? `${countMatches(st.lines, st.find.query)} match${countMatches(st.lines, st.find.query) === 1 ? '' : 'es'}` : 'type to search'} · ${where} · Enter next · ↑ prev · Tab closes`}
      </Text>
    </Box>
  ) : (
    <Text dimColor wrap="truncate-end">
      {`${dirty ? '● unsaved' : 'saved'} · ${where}${language ? ` · ${language}` : ''} · ctrl+s save · ctrl+z undo · ctrl+y redo · ctrl+f find · esc leaves`}
    </Text>
  )

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {drawn}
      {status}
    </Box>
  )
}

export default Editor
