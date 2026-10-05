import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { EditorMessage, Explorer, Pending, TreeEntry } from '../types/index.d.ts'

const PANE = 'file-explorer'

const INITIAL: Explorer = {
  root: '',
  expanded: [],
  listings: {},
  filter: '',
  index: null,
  indexTruncated: false,
  selected: null,
  content: null,
  eol: '\n',
  draft: null,
  request: null,
  pending: null,
  notice: null,
}

const explorer = atom({ plugin: 'file-explorer', key: 'explorer' } as const, INITIAL)

/** Folders drawn collapsed and never listed into state until opened. */
const MAX_ENTRIES = 400
/** Rows the tree draws before it says "… n more". */
const MAX_ROWS = 600
/** What the read-only Code view (surfaces without a Client) can hold. */
const CODE_LIMIT = 9_500
/** Files the index stops at, and folders it descends into, so a filter stays quick. */
const INDEX_FILES = 5_000
const INDEX_DIRS = 1_000

/** Folders and files nobody opens by hand; hidden unless the `showIgnored` option is on. */
const IGNORED = new Set([
  '.git',
  'node_modules',
  '.DS_Store',
  'Thumbs.db',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.venv',
  'venv',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  '.parcel-cache',
  '.svelte-kit',
  '.gradle',
  '.idea',
])
let showIgnored = false
const isShown = (name: string) => showIgnored || !IGNORED.has(name)

/** What the last draw used, for the wheel hook to tell the editor's cells from the tree's. */
const layout = { treeWidth: 30, editing: false }

/**
 * A prompt that asks for nothing but the pane: "open the editor", "hey claude,
 * please open the file explorer". It matches the whole text, so a prompt that
 * also names or describes a file ("open the user show page in the editor")
 * reaches the model, which finds the path and calls the `open_file` tool.
 */
const OPEN_PHRASE =
  /^\s*(?:(?:hey|hi|ok|yo)?,?\s*claude,?\s*)?(?:please\s+|can you\s+|could you\s+|would you\s+)?(?:open|show|launch|bring up|pop open)\s+(?:up\s+)?(?:me\s+)?(?:the\s+|a\s+|an\s+|your\s+|my\s+)?(?:text\s+|code\s+|file\s+|files\s+)?(?:editor|explorer|browser|tree|panel|pane)(?:\s+pane|\s+panel)?(?:\s+(?:for me|please|now|up))*\s*[.!?]*\s*$/i
const isOpenRequest = (text: string) => OPEN_PHRASE.test(text)

const join = (dir: string, name: string) => (dir.endsWith('/') ? dir + name : `${dir}/${name}`)

const parentOf = (path: string) => {
  const cut = path.lastIndexOf('/')
  return cut <= 0 ? '/' : path.slice(0, cut)
}

const relative = (root: string, path: string) =>
  path === root ? '.' : path.startsWith(root + '/') ? path.slice(root.length + 1) : path

const sortEntries = (a: TreeEntry, b: TreeEntry) => {
  const aDir = a.kind === 'dir'
  const bDir = b.kind === 'dir'
  if (aDir !== bDir) return aDir ? -1 : 1
  return a.name.localeCompare(b.name)
}

const listDir = async ($: EngineInterface, path: string): Promise<TreeEntry[]> => {
  const entries = await $.fs.list(path)
  return entries
    .filter(e => isShown(e.name))
    .map(e => ({ name: e.name, kind: e.kind }))
    .sort(sortEntries)
    .slice(0, MAX_ENTRIES)
}

/** Drops control characters a Text may not hold; keeps tab and newline. */
const clean = (text: string) => text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')

/** Reads `path` into the editor; a fresh file starts clean, with no draft or pending ask. */
const loadFile = async ($: EngineInterface, path: string) => {
  try {
    const raw = await $.fs.read(path)
    const eol: Explorer['eol'] = raw.includes('\r\n') ? '\r\n' : '\n'
    const content = clean(raw.replace(/\r\n/g, '\n'))
    await update($, explorer, s => ({ ...s, selected: path, content, eol, draft: null, request: null, pending: null, notice: null }))
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    await update($, explorer, s => ({
      ...s,
      selected: path,
      content: null,
      draft: null,
      request: null,
      pending: null,
      notice: { kind: 'error' as const, text: `Cannot read file: ${reason}` },
    }))
  }
}

const toggleDir = async ($: EngineInterface, path: string) => {
  const s = await read($, explorer)
  if (s.expanded.includes(path)) {
    await update($, explorer, x => ({ ...x, expanded: x.expanded.filter(p => p !== path) }))
    return
  }
  const listing = s.listings[path] ?? (await listDir($, path).catch(() => []))
  await update($, explorer, x => ({
    ...x,
    expanded: [...x.expanded, path],
    listings: { ...x.listings, [path]: listing },
  }))
}

const refreshDir = async ($: EngineInterface, path: string) => {
  const listing = await listDir($, path).catch(() => [])
  await update($, explorer, x => ({ ...x, listings: { ...x.listings, [path]: listing } }))
}

const isDirty = (s: Explorer) => s.draft !== null && s.draft !== s.content

/**
 * Every file under `root` as a relative path, breadth first, ignored folders
 * skipped, stopping at INDEX_FILES files or INDEX_DIRS folders. Built once per
 * root, on the first filter, and again after a refresh.
 */
const buildIndex = async ($: EngineInterface, root: string) => {
  const files: string[] = []
  const queue = [root]
  let dirs = 0
  let truncated = false
  while (queue.length > 0 && files.length < INDEX_FILES) {
    if (dirs++ >= INDEX_DIRS) {
      truncated = true
      break
    }
    const dir = queue.shift()!
    const entries = await $.fs.list(dir).catch(() => [])
    for (const entry of entries) {
      if (!isShown(entry.name)) continue
      const path = join(dir, entry.name)
      if (entry.kind === 'dir') queue.push(path)
      else if (entry.kind === 'file') files.push(relative(root, path))
    }
  }
  if (queue.length > 0 || files.length >= INDEX_FILES) truncated = true
  files.sort((a, b) => a.localeCompare(b))
  await update($, explorer, x => (x.root === root ? { ...x, index: files, indexTruncated: truncated } : x))
}

/** The index entries every space-separated term of `filter` appears in, case-insensitively. */
const matches = (index: string[], filter: string) => {
  const terms = filter.toLowerCase().split(/\s+/).filter(Boolean)
  return terms.length === 0 ? [] : index.filter(rel => terms.every(t => rel.toLowerCase().includes(t)))
}

const setFilter = async ($: EngineInterface, filter: string) => {
  const s = await read($, explorer)
  await update($, explorer, x => ({ ...x, filter }))
  if (filter.trim() && s.index === null && s.root) await buildIndex($, s.root)
}

/**
 * After Claude's Edit, Write or NotebookEdit lands: the folder's listing is
 * re-read when the tree shows it, the file when it is the one open and clean.
 * A new file also drops the index, so the next filter sees it.
 */
const afterExternalEdit = async ($: EngineInterface, path: string) => {
  const s = await read($, explorer)
  if (!s.root || !path.startsWith(s.root + '/')) return
  const panes = await $.ui.panes()
  if (!panes.some(p => p.id === PANE)) return

  const dir = parentOf(path)
  if (s.listings[dir]) await refreshDir($, dir)
  if (s.index && !s.index.includes(relative(s.root, path))) await update($, explorer, x => ({ ...x, index: null }))

  if (s.selected !== path) return
  if (isDirty(s)) {
    await update($, explorer, x => ({
      ...x,
      notice: { kind: 'error' as const, text: 'Claude changed this file on disk. Your unsaved edits are kept; save overwrites the disk.' },
    }))
    return
  }
  await loadFile($, path)
  const at = new Date().toLocaleTimeString()
  await update($, explorer, x => (x.selected === path ? { ...x, notice: { kind: 'ok' as const, text: `Reloaded at ${at}: Claude edited this file` } } : x))
}

/** Writes `text` to the selected file, keeping its line endings, and updates the view. */
const saveText = async ($: EngineInterface, s: Explorer, path: string, text: string) => {
  try {
    await $.fs.write(path, s.eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text)
    const at = new Date().toLocaleTimeString()
    await update($, explorer, x => ({ ...x, content: text, draft: null, notice: { kind: 'ok' as const, text: `Saved at ${at}` } }))
    $.ui.toast(`✓ Saved ${relative(s.root, path)}`)
    return true
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    await update($, explorer, x => ({ ...x, pending: null, notice: { kind: 'error' as const, text: `Save failed: ${reason}` } }))
    $.ui.toast(`✗ Save failed: ${reason}`)
    return false
  }
}

/** The pane's save button: writes the editor's draft. */
const saveDraft = async ($: EngineInterface) => {
  const s = await read($, explorer)
  if (!s.selected || s.draft === null) return false
  return saveText($, s, s.selected, s.draft)
}

/** The pane's revert button: back to the saved text, as one undoable step. */
const revertDraft = ($: EngineInterface) =>
  update($, explorer, x => ({ ...x, draft: null, request: { kind: 'revert' as const, n: (x.request?.n ?? 0) + 1 } }))

const closePane = async ($: EngineInterface) => {
  await $.ui.close({ id: PANE })
  $.ui.log('Editor closed.')
}

/** Does what the person asked once the editor's changes are saved or discarded. */
const perform = async ($: EngineInterface, pending: Pending) => {
  if (pending.kind === 'close') await closePane($)
  else await loadFile($, pending.path)
}

/** Leaves the current file for `pending`; with unsaved changes, asks first. */
const leaveFile = async ($: EngineInterface, pending: Pending) => {
  const s = await read($, explorer)
  if (isDirty(s)) {
    await update($, explorer, x => ({ ...x, pending }))
    return
  }
  await perform($, pending)
}

/** Lists the root, expands the parents of `file` when given, and opens the pane. */
const openExplorer = async ($: EngineInterface, file?: string) => {
  const root = await $.session.cwd()
  const current = await read($, explorer)
  const listings = { ...current.listings }
  if (current.root !== root || !listings[root]) listings[root] = await listDir($, root).catch(() => [])

  let expanded = current.root === root ? [...current.expanded] : []
  let target: string | undefined
  if (file) {
    target = file.startsWith('/') ? file : join(root, file.replace(/^\.\//, ''))
    for (let dir = parentOf(target); dir.startsWith(root) && dir !== root; dir = parentOf(dir)) {
      if (!expanded.includes(dir)) expanded = [dir, ...expanded]
      if (!listings[dir]) listings[dir] = await listDir($, dir).catch(() => [])
    }
  }

  await update($, explorer, s => ({ ...s, root, expanded, listings }))
  if (target) await loadFile($, target)

  const placed = await $.ui.open({ id: PANE, title: 'Editor', focus: true, closeOnEscape: true, columns: 120, rows: 40 })
  if (placed.isPlaced) $.ui.log(`Editor opened${target ? `: ${relative(root, target)}` : ''}.`)
  return placed
}

export const register: Register = (on, options) => {
  showIgnored = options.showIgnored === true

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'editor',
      description: 'Open the editor pane with a file tree (optionally /editor <path> to open a file)',
    })
    // The model's way in: "open the user show page in the editor" becomes a
    // Glob or Grep for the path, then this call.
    await $.tool.register({
      name: 'open_file',
      description:
        "Opens a file in the person's editor pane (the file-explorer plugin: a file tree with a text editor). " +
        'Use it when they ask to open, show, view or edit a file in the editor, text editor, file explorer or pane. ' +
        'When they describe the file instead of naming it ("the user show page"), find its path first with Glob or Grep, then call this with that path. ' +
        'The path is relative to the working directory or absolute. Opens the pane if it is closed.',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'The file to open, relative to the working directory or absolute.' } },
        required: ['path'],
      },
    })
    return next(e)
  })

  on('command.run', { command: 'editor' }, async ($, e) => {
    const file = (e.args ?? '').trim() || undefined
    const placed = await openExplorer($, file)
    return {
      text: placed.isPlaced ? `Editor opened${file ? `: ${file}` : ''}.` : `The editor is waiting for a wider terminal (${placed.reason}).`,
    }
  })

  on('tool.call', { tool: 'mcp__file-explorer__open_file' }, async ($, e) => {
    const path = typeof e.path === 'string' ? e.path.trim() : ''
    if (!path) return { deny: 'open_file: give the path of the file to open.' }
    const placed = await openExplorer($, path)
    const s = await read($, explorer)
    const problem = s.notice?.kind === 'error' ? s.notice.text : null
    const where = s.root ? relative(s.root, s.selected ?? path) : path
    // An MCP tool's result is text (or content blocks), never a bare object.
    const text = problem
      ? `Could not open ${where}: ${problem}`
      : placed.isPlaced
        ? `Opened ${where} in the editor pane.`
        : `${where} is loaded; the editor pane waits for a wider terminal (${placed.reason}).`
    return { result: text }
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'composer' || !isOpenRequest(e.text)) return next(e)
    const placed = await openExplorer($)
    return {
      // The engine prints this as "Prompt dropped by a hook: <reason>".
      drop: placed.isPlaced ? 'opened the editor instead' : `the editor needs a wider terminal (${placed.reason})`,
    }
  })

  // One dim transcript line when the person closes the pane with Escape or
  // the engine's own close; the x button logs from its own handler, since a
  // plugin's hooks do not see its own $.ui.close.
  on('ui.close', { id: PANE }, async ($, e, next) => {
    const done = await next(e)
    if (e.origin.kind === 'person') $.ui.log('Editor closed.')
    return done
  })

  // Claude's own edits land in the pane: the tree and the open file follow the disk.
  on('tool.call', { tool: ['Edit', 'Write', 'NotebookEdit'] }, async ($, e, next) => {
    const done = await next(e)
    const path = 'file_path' in e ? e.file_path : 'notebook_path' in e ? e.notebook_path : undefined
    if (done.deny === undefined && done.isError !== true && typeof path === 'string') {
      await afterExternalEdit($, path).catch(() => undefined)
    }
    return done
  })

  // The wheel over the editor scrolls its lines; over the tree, the pane body as usual.
  on('ui.scroll', { requestId: PANE }, async ($, e, next) => {
    const overEditor = e.origin.kind === 'person' && e.pointer !== undefined && layout.editing && e.pointer.column >= layout.treeWidth
    if (!overEditor || e.by === 0) return next(e)
    const by = e.by
    await update($, explorer, x => ({ ...x, request: { kind: 'scroll' as const, by, n: (x.request?.n ?? 0) + 1 } }))
    return {}
  })

  on('ui.message', { requestId: PANE }, async ($, e) => {
    const msg = e.data as Partial<EditorMessage> | null
    if (!msg || typeof msg !== 'object' || typeof msg.path !== 'string') return {}
    const s = await read($, explorer)
    if (msg.path !== s.selected) return {}

    if (msg.type === 'save' && typeof msg.text === 'string') {
      const saved = await saveText($, s, msg.path, msg.text)
      if (saved && s.pending) await perform($, s.pending)
    } else if (msg.type === 'draft' && typeof msg.text === 'string') {
      const draft = msg.text
      await update($, explorer, x => ({ ...x, draft: draft === x.content ? null : draft }))
    }
    return {}
  })


  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button, Code } = els
    // The directory's scan reads `Client` only as a JSX tag with a literal
    // `module`, so the element is written as `els.Client` where it is drawn.
    const hasClient = 'Client' in els
    // The mobile app draws no Input yet: there the tree has no filter box.
    const Input = 'Input' in els ? els.Input : undefined
    const s = await read($, explorer)

    const bodyColumns = e.props.bodyColumns || e.viewport?.columns || 100
    const treeWidth = Math.max(22, Math.min(40, Math.floor(bodyColumns * 0.32)))
    const bodyRows = e.viewport?.rows ?? 30
    const editorRows = Math.max(6, bodyRows - 5)
    // A file opens straight into the editor wherever a Client can draw one
    // (terminal, desktop); elsewhere it is read-only.
    const editing = hasClient && s.selected !== null && s.content !== null
    layout.treeWidth = treeWidth
    layout.editing = editing
    const dirty = isDirty(s)
    const rel = s.selected ? relative(s.root, s.selected) : null
    const lineCount = s.content === null ? 0 : s.content.split('\n').length

    type Row = { path: string; name: string; kind: TreeEntry['kind']; depth: number }
    const rows: Row[] = []
    let hidden = 0
    const walk = (dir: string, depth: number) => {
      for (const entry of s.listings[dir] ?? []) {
        const path = join(dir, entry.name)
        if (rows.length >= MAX_ROWS) {
          hidden++
          continue
        }
        rows.push({ path, name: entry.name, kind: entry.kind, depth })
        if (entry.kind === 'dir' && s.expanded.includes(path)) walk(path, depth + 1)
      }
    }
    if (s.root) walk(s.root, 0)

    const rowLabel = (row: Row) => {
      const indent = '  '.repeat(row.depth)
      const glyph = row.kind === 'dir' ? (s.expanded.includes(row.path) ? '▾ ' : '▸ ') : '  '
      return `${indent}${glyph}${row.name}${row.kind === 'dir' ? '/' : ''}`
    }

    // One row holds everything: what is open on the left, every control on the right.
    const header = (
      <Box flexDirection="row" justifyContent="space-between" gap={2} paddingX={1}>
        <Box flexDirection="row" gap={1} flexShrink={1} minWidth={0}>
          <Box flexShrink={0}>
            <Text bold>Editor</Text>
          </Box>
          {/* The path gives way first and keeps its tail; the counts and buttons keep their room. */}
          <Box flexShrink={1} minWidth={12}>
            {rel ? (
              <Text bold wrap="truncate-start">
                {rel}
              </Text>
            ) : (
              <Text dimColor wrap="truncate-start">
                {s.root || '(no folder)'}
              </Text>
            )}
          </Box>
          {rel && s.content !== null && (
            <Box flexShrink={0}>
              <Text dimColor>
                {lineCount} lines{editing ? (dirty ? ' ·' : ' · click the editor to type') : ''}
              </Text>
            </Box>
          )}
          {editing && dirty && (
            <Box flexShrink={0}>
              <Text color="yellow">● unsaved</Text>
            </Box>
          )}
        </Box>
        <Box flexDirection="row" gap={1} flexShrink={0}>
          {editing && (
            <Button key="save" variant="primary" dimColor={!dirty} onPress={() => saveDraft($)}>
              save
            </Button>
          )}
          {editing && (
            <Button key="revert" dimColor={!dirty} onPress={() => revertDraft($)}>
              revert
            </Button>
          )}
          <Button
            key="refresh"
            hotkey={editing ? undefined : 'r'}
            dimColor
            onPress={async () => {
              if (s.root) await refreshDir($, s.root)
              for (const dir of s.expanded) await refreshDir($, dir)
              // A file being edited keeps its draft; a clean one is re-read.
              if (s.selected && !dirty) await loadFile($, s.selected)
              // The index is rebuilt now while a filter shows it, else on the next filter.
              await update($, explorer, x => ({ ...x, index: null, indexTruncated: false }))
              if (s.root && s.filter.trim()) await buildIndex($, s.root)
            }}
          >
            refresh
          </Button>
          <Button key="close" role="dismiss" hotkey={editing ? undefined : 'x'} onPress={() => leaveFile($, { kind: 'close' })}>
            x close
          </Button>
        </Box>
      </Box>
    )

    const filtering = s.filter.trim().length > 0
    const hits = filtering && s.index ? matches(s.index, s.filter) : []
    const filterBox = Input && (
      <Input
        key="filter"
        placeholder="filter files"
        value={s.filter}
        submitLabel="open"
        onInput={(value: string) => setFilter($, value)}
        onSubmit={async (value: string) => {
          const current = await read($, explorer)
          const first = current.index ? matches(current.index, value)[0] : undefined
          if (first && current.root) await leaveFile($, { kind: 'open', path: join(current.root, first) })
        }}
      />
    )

    const tree = filtering ? (
      <Box flexDirection="column" width={treeWidth} paddingX={1}>
        {filterBox}
        {s.index === null ? (
          <Text dimColor>Indexing…</Text>
        ) : hits.length === 0 ? (
          <Text dimColor>No match{s.indexTruncated ? ' in the first ' + INDEX_FILES + ' files' : ''}.</Text>
        ) : (
          <Text dimColor>
            {hits.length > MAX_ROWS ? `${MAX_ROWS} of ` : ''}
            {hits.length} match{hits.length === 1 ? '' : 'es'}
            {s.indexTruncated ? ' (index capped)' : ''} · Enter opens the first
          </Text>
        )}
        {hits.slice(0, MAX_ROWS).map(rel => {
          const path = join(s.root, rel)
          return (
            <Button key={`hit:${rel}`} plain dimColor={path !== s.selected} onPress={() => leaveFile($, { kind: 'open', path })}>
              {rel}
            </Button>
          )
        })}
      </Box>
    ) : (
      <Box flexDirection="column" width={treeWidth} paddingX={1}>
        {filterBox}
        {rows.length === 0 && <Text dimColor>Empty folder.</Text>}
        {rows.map(row => (
          <Button
            key={`row:${row.path}`}
            plain
            dimColor={row.path !== s.selected}
            onPress={() => (row.kind === 'dir' ? toggleDir($, row.path) : leaveFile($, { kind: 'open', path: row.path }))}
          >
            {rowLabel(row)}
          </Button>
        ))}
        {hidden > 0 && <Text dimColor>… {hidden} more (collapse folders to see)</Text>}
      </Box>
    )

    const notice = s.notice && (
      <Box>
        <Text backgroundColor={s.notice.kind === 'ok' ? 'green' : 'red'} color="black" bold>
          {` ${s.notice.kind === 'ok' ? '✓' : '✗'} ${s.notice.text} `}
        </Text>
      </Box>
    )

    const ask = editing && s.pending && (
      <Box flexDirection="row" gap={1}>
        <Text color="yellow">Unsaved changes.</Text>
        <Button
          key="pending-save"
          variant="primary"
          onPress={async () => {
            const { pending } = await read($, explorer)
            if ((await saveDraft($)) && pending) await perform($, pending)
          }}
        >
          save and continue
        </Button>
        <Button
          key="pending-discard"
          onPress={async () => {
            const { pending } = await read($, explorer)
            if (pending) await perform($, pending)
          }}
        >
          discard
        </Button>
        <Button key="pending-stay" onPress={() => update($, explorer, x => ({ ...x, pending: null }))}>
          keep editing
        </Button>
      </Box>
    )

    let main
    if (!s.selected) {
      main = <Text dimColor>Select a file on the left. Folders expand with Enter or a click.</Text>
    } else if (s.content === null) {
      main = <Text dimColor>No content.</Text>
    } else if (editing && 'Client' in els) {
      main = (
        <els.Client
          key={`editor:${s.selected}`}
          module="./editor.tsx"
          props={{ path: s.selected, text: s.content, request: s.request }}
          width="100%"
          height={editorRows}
        />
      )
    } else {
      const truncated = s.content.length > CODE_LIMIT
      main = (
        <Box flexDirection="column">
          {truncated && <Text color="yellow">Showing the first {CODE_LIMIT} characters; editing needs the terminal or desktop app.</Text>}
          <Code source={truncated ? s.content.slice(0, CODE_LIMIT) : s.content} path={s.selected} startLine={1} wrap="truncate-end" />
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        {header}
        <Box flexDirection="row">
          {tree}
          <Box flexDirection="column" flexGrow={1} borderStyle="single" borderDimColor paddingX={1}>
            {notice}
            {ask}
            {main}
          </Box>
        </Box>
      </Box>
    )
  })
}
