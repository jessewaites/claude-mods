import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

const ROOT = '/repo'

const PANE_PROPS = {
  title: 'Files',
  isFocused: true,
  bodyColumns: 120,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

test('lists the folder, opens a file, and saves an edit', async ($, on) => {
  const files: Record<string, string> = { '/repo/README.md': 'Hello.\n', '/repo/app/main.rb': 'puts 1\n' }
  const written: Array<{ path: string; text: string }> = []

  on('session.cwd', async () => ({ value: ROOT }))
  on('fs.list', async (_$, e) => {
    if (e.path === ROOT)
      return {
        value: [
          { name: 'README.md', kind: 'file' as const, size: 7, mtimeMs: 0, isLink: false },
          { name: 'app', kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false },
        ],
      }
    if (e.path === '/repo/app')
      return { value: [{ name: 'main.rb', kind: 'file' as const, size: 7, mtimeMs: 0, isLink: false }] }
    return { value: [] }
  })
  on('fs.read', async (_$, e) => {
    const text = files[e.path]
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('fs.write', async (_$, e) => {
    written.push({ path: e.path, text: e.text })
    files[e.path] = e.text
    return { value: undefined }
  })
  on('ui.open', async () => ({ value: { isPlaced: true as const } }))
  on('ui.toast', async () => ({ value: undefined }))
  const logged: string[] = []
  on('ui.log', async (_$, e) => {
    logged.push(e.text)
    return { value: undefined }
  })
  on('ui.close', async () => ({ value: undefined }))

  const run = await $.command.run({
    command: 'editor',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 140 },
  })
  expect(run.text).toMatch(/opened/)

  const ui = await $.ui.mount({
    plugin: 'file-explorer',
    surface: 'terminal',
    component: 'Pane',
    props: PANE_PROPS,
    requestId: 'file-explorer',
    viewport: { columns: 140, rows: 40, isFullscreen: true },
  })

  // Folders first, then files, as GitHub draws them.
  expect((await ui.find({ key: 'row:/repo/app' }))?.text).toBe('▸ app/')
  expect((await ui.find({ key: 'row:/repo/README.md' }))?.text).toBe('  README.md')
  expect(await ui.find({ key: 'close' })).toBeDefined()

  // Expanding a folder lists it and indents its children.
  await ui.press({ key: 'row:/repo/app' })
  expect((await ui.find({ key: 'row:/repo/app/main.rb' }))?.text).toBe('    main.rb')

  // Opening a file goes straight into the editor, with every control on the header row.
  await ui.press({ key: 'row:/repo/README.md' })
  const ed = 'editor:/repo/README.md'
  expect(await ui.find({ key: ed })).toBeDefined()
  expect(await ui.find({ type: 'Code' })).toBeUndefined()
  for (const key of ['save', 'revert', 'refresh', 'close']) expect(await ui.find({ key })).toBeDefined()

  // Typing marks it dirty; undo and redo walk the history.
  await ui.key({ key: 'end', in: ed })
  await ui.key({ key: 'backspace', in: ed })
  await ui.key({ key: '!', in: ed })
  await ui.key({ key: '!', in: ed })
  expect((await ui.find({ type: 'Text', text: /unsaved/, in: ed }))).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /● unsaved/ })).toBeDefined()
  // The cursor splits its line into Texts, so match the piece before it.
  await ui.key({ key: 'z', ctrl: true, in: ed })
  expect(await ui.find({ type: 'Text', text: /^Hello$/, in: ed })).toBeDefined()
  await ui.key({ key: 'y', ctrl: true, in: ed })
  expect(await ui.find({ type: 'Text', text: /^Hello!!$/, in: ed })).toBeDefined()
  // The space bar may arrive under its name rather than as a character.
  await ui.key({ key: 'space', in: ed })
  expect(await ui.find({ type: 'Text', text: /^Hello!! $/, in: ed })).toBeDefined()
  await ui.key({ key: 'backspace', in: ed })

  // Switching files with unsaved changes asks first; "save and continue" writes, then opens the other file.
  await ui.press({ key: 'row:/repo/app/main.rb' })
  expect(await ui.find({ key: ed })).toBeDefined()
  expect(await ui.find({ key: 'pending-save' })).toBeDefined()
  await ui.press({ key: 'pending-save' })
  expect(written).toEqual([{ path: '/repo/README.md', text: 'Hello!!\n' }])
  expect(await ui.find({ key: ed })).toBeUndefined()
  expect(await ui.find({ key: 'editor:/repo/app/main.rb' })).toBeDefined()

  // ctrl+s saves straight from the keyboard; revert puts the saved text back.
  await ui.press({ key: 'row:/repo/README.md' })
  await ui.key({ key: 'end', in: ed })
  await ui.key({ key: '?', in: ed })
  await ui.key({ key: 's', ctrl: true, in: ed })
  expect(written[1]).toEqual({ path: '/repo/README.md', text: 'Hello!!?\n' })
  const saved = await ui.find({ type: 'Text', text: /✓ Saved at/ })
  expect(saved?.props.backgroundColor).toBe('green')
  expect(saved?.props.color).toBe('black')

  // A click drops the cursor: the gutter is 2 cells wide for a 2-line file, so x=4 is column 3.
  await ui.pointer({ type: 'down', x: 4, y: 0, button: 'left', in: ed })
  expect(await ui.find({ type: 'Text', text: /Ln 1, Col 3/, in: ed })).toBeDefined()
  await ui.key({ key: 'end', in: ed })
  await ui.key({ key: 'x', in: ed })
  await ui.press({ key: 'revert' })
  await ui.key({ key: 'end', in: ed })
  expect(await ui.find({ type: 'Text', text: /^Hello!!\?$/, in: ed })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^saved/, in: ed })).toBeDefined()

  // Closing with unsaved changes asks too; discarding drops the edit and closes.
  await ui.key({ key: 'q', in: ed })
  await ui.press({ key: 'close' })
  expect(await ui.find({ key: 'pending-discard' })).toBeDefined()
  await ui.press({ key: 'pending-discard' })
  expect(written).toHaveLength(2)

  // The transcript gets one line on open and one on close.
  expect(logged).toEqual(['Editor opened.', 'Editor closed.'])
})

test('the phrase "open the editor" opens the pane instead of reaching the model', async ($, on) => {
  let opened = 0
  on('session.cwd', async () => ({ value: ROOT }))
  on('fs.list', async () => ({ value: [] }))
  on('ui.open', async () => {
    opened++
    return { value: { isPlaced: true as const } }
  })
  on('ui.log', async () => ({ value: undefined }))
  let reachedModel = 0
  on('prompt.submit', async (_$, e) => {
    reachedModel++
    return { text: e.text }
  })

  for (const phrase of ['open the editor', 'Hey Claude, please open the file editor.', 'show me the file tree', 'open the file explorer']) {
    const result = await $.prompt.submit({ text: phrase, origin: { kind: 'composer' }, wait: false })
    expect('drop' in result && typeof result.drop === 'string').toBe(true)
  }
  expect(opened).toBe(4)
  expect(reachedModel).toBe(0)

  // A request that names or describes a file reaches the model, which uses the open_file tool.
  for (const text of [
    'Can you open the file explorer mod source and add a search box to the tree?',
    'open the user show page in the editor',
    'open app/models/user.rb in the editor',
  ]) {
    await $.prompt.submit({ text, origin: { kind: 'composer' }, wait: false })
  }
  expect(reachedModel).toBe(3)
  expect(opened).toBe(4)
})

test('the open_file tool opens a path the model resolved, and reports one it cannot read', async ($, on) => {
  const written: string[] = []
  on('session.cwd', async () => ({ value: ROOT }))
  on('fs.list', async (_$, e) =>
    e.path === ROOT
      ? { value: [{ name: 'app', kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false }] }
      : { value: [{ name: 'main.rb', kind: 'file' as const, size: 7, mtimeMs: 0, isLink: false }] },
  )
  on('fs.read', async (_$, e) => (e.path === '/repo/app/main.rb' ? { value: 'puts 1\n' } : { deny: 'ENOENT' }))
  on('ui.open', async () => ({ value: { isPlaced: true as const } }))
  on('ui.log', async (_$, e) => {
    written.push(e.text)
    return { value: undefined }
  })

  const opened = await $.tool.call({ tool: 'mcp__file-explorer__open_file', path: 'app/main.rb' })
  expect(opened.deny).toBeUndefined()
  expect(opened.result).toBe('Opened app/main.rb in the editor pane.')
  expect(written).toEqual(['Editor opened: app/main.rb.'])

  const ui = await $.ui.mount({
    plugin: 'file-explorer',
    surface: 'terminal',
    component: 'Pane',
    props: PANE_PROPS,
    requestId: 'file-explorer',
    viewport: { columns: 140, rows: 40, isFullscreen: true },
  })
  expect(await ui.find({ key: 'editor:/repo/app/main.rb' })).toBeDefined()
  // The folder on the way to the file is expanded in the tree.
  expect(await ui.find({ key: 'row:/repo/app/main.rb' })).toBeDefined()

  const missing = await $.tool.call({ tool: 'mcp__file-explorer__open_file', path: 'app/nope.rb' })
  expect(missing.result).toMatch(/^Could not open app\/nope\.rb: /)

  const blank = await $.tool.call({ tool: 'mcp__file-explorer__open_file', path: '  ' })
  expect(blank.deny).toMatch(/give the path/)
})

test('the editor colours code by the file type, and leaves unknown types plain', async ($, on) => {
  const files: Record<string, string> = {
    '/repo/app/main.rb': 'def hi # note\n  puts "x"\nend\n',
    '/repo/notes.unknownext': 'puts "x"\n',
  }
  on('session.cwd', async () => ({ value: ROOT }))
  on('fs.list', async (_$, e) =>
    e.path === ROOT
      ? {
          value: [
            { name: 'notes.unknownext', kind: 'file' as const, size: 9, mtimeMs: 0, isLink: false },
            { name: 'app', kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false },
          ],
        }
      : { value: [{ name: 'main.rb', kind: 'file' as const, size: 30, mtimeMs: 0, isLink: false }] },
  )
  on('fs.write', async () => ({ deny: 'EACCES: read-only' }))
  on('ui.toast', async () => ({ value: undefined }))
  on('fs.read', async (_$, e) => ({ value: files[e.path] ?? '' }))
  on('ui.open', async () => ({ value: { isPlaced: true as const } }))
  on('ui.log', async () => ({ value: undefined }))

  await $.command.run({ command: 'editor', args: 'app/main.rb', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 140 } })
  const ui = await $.ui.mount({
    plugin: 'file-explorer',
    surface: 'terminal',
    component: 'Pane',
    props: PANE_PROPS,
    requestId: 'file-explorer',
    viewport: { columns: 140, rows: 40, isFullscreen: true },
  })

  // Ruby: keywords, the function name, the comment and the string each get their colour.
  const ed = 'editor:/repo/app/main.rb'
  // Move the cursor off line 1 so its tokens are whole.
  await ui.key({ key: 'down', in: ed })
  await ui.key({ key: 'down', in: ed })
  expect((await ui.find({ type: 'Text', text: /^def$/, in: ed }))?.props.color).toBe('magenta')
  expect((await ui.find({ type: 'Text', text: /^hi$/, in: ed }))?.props.color).toBe('blue')
  expect((await ui.find({ type: 'Text', text: /^# note$/, in: ed }))?.props.dimColor).toBe(true)
  expect((await ui.find({ type: 'Text', text: /^"x"$/, in: ed }))?.props.color).toBe('green')
  expect(await ui.find({ type: 'Text', text: /· ruby ·/, in: ed })).toBeDefined()

  // Typing keeps the colours current: a new string on line 3 is green.
  await ui.key({ key: 'end', in: ed })
  await ui.key({ key: 'return', in: ed })
  for (const ch of `'y'`) await ui.key({ key: ch, in: ed })
  await ui.key({ key: 'up', in: ed })
  expect((await ui.find({ type: 'Text', text: /^'y'$/, in: ed }))?.props.color).toBe('green')

  // A refused write shows a red banner, and the draft stays.
  await ui.key({ key: 's', ctrl: true, in: ed })
  const failed = await ui.find({ type: 'Text', text: /✗ Save failed: .*EACCES/ })
  expect(failed?.props.backgroundColor).toBe('red')
  expect(failed?.props.color).toBe('black')
  expect(await ui.find({ type: 'Text', text: /● unsaved/ })).toBeDefined()

  // An unknown extension is drawn plain, with no language in the status line.
  await ui.press({ key: 'row:/repo/notes.unknownext' })
  await ui.press({ key: 'pending-discard' })
  const plain = 'editor:/repo/notes.unknownext'
  await ui.key({ key: 'down', in: plain })
  const row = await ui.find({ type: 'Text', text: /^puts "x"$/, in: plain })
  expect(row).toBeDefined()
  expect(row?.props.color).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Col 1 · ctrl\+s/, in: plain })).toBeDefined()
})

const TREE: Record<string, Array<{ name: string; kind: 'file' | 'dir' }>> = {
  '/repo': [
    { name: 'README.md', kind: 'file' },
    { name: 'app', kind: 'dir' },
    { name: '.git', kind: 'dir' },
    { name: 'node_modules', kind: 'dir' },
  ],
  '/repo/app': [
    { name: 'main.rb', kind: 'file' },
    { name: 'models', kind: 'dir' },
  ],
  '/repo/app/models': [{ name: 'user.rb', kind: 'file' }],
  '/repo/.git': [{ name: 'HEAD', kind: 'file' }],
  '/repo/node_modules': [{ name: 'left-pad', kind: 'dir' }],
}

const mountTree = async ($: Engine, on: On, files: Record<string, string>) => {
  on('session.cwd', async () => ({ value: ROOT }))
  on('fs.list', async (_$, e) => ({
    value: (TREE[e.path] ?? []).map(entry => ({ ...entry, size: 0, mtimeMs: 0, isLink: false })),
  }))
  on('fs.read', async (_$, e) => ({ value: files[e.path] ?? '' }))
  on('ui.open', async () => ({ value: { isPlaced: true as const } }))
  on('ui.panes', async () => ({ value: [{ id: 'file-explorer', title: 'Files', isShown: true, isFocused: true, isPlaced: true }] }))
  on('ui.log', async () => ({ value: undefined }))
  on('ui.toast', async () => ({ value: undefined }))
  await $.command.run({ command: 'editor', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 140 } })
  return $.ui.mount({
    plugin: 'file-explorer',
    surface: 'terminal',
    component: 'Pane',
    props: PANE_PROPS,
    requestId: 'file-explorer',
    viewport: { columns: 140, rows: 40, isFullscreen: true },
  })
}

test('hides ignored folders, filters the whole tree by name, and follows Claude\'s edits', async ($, on) => {
  const files: Record<string, string> = { '/repo/app/models/user.rb': 'class User\nend\n', '/repo/README.md': 'Hi\n' }
  on('tool.call', async (_$, e) => {
    if (e.tool !== 'Write') return { deny: 'not in this test' }
    files[e.file_path] = e.content
    return { result: { type: 'update' as const, filePath: e.file_path, content: e.content, structuredPatch: [], originalFile: null } }
  })
  const ui = await mountTree($, on, files)

  // .git and node_modules are not drawn.
  expect(await ui.find({ key: 'row:/repo/app' })).toBeDefined()
  expect(await ui.find({ key: 'row:/repo/.git' })).toBeUndefined()
  expect(await ui.find({ key: 'row:/repo/node_modules' })).toBeUndefined()

  // The filter finds a file in a folder never expanded, and never an ignored one.
  await ui.input({ key: 'filter', text: 'user', kind: 'change' })
  expect(await ui.find({ key: 'hit:app/models/user.rb' })).toBeDefined()
  expect(await ui.find({ key: 'row:/repo/app' })).toBeUndefined()
  await ui.input({ key: 'filter', text: 'HEAD', kind: 'change' })
  expect(await ui.find({ type: 'Text', text: /No match/ })).toBeDefined()
  await ui.input({ key: 'filter', text: 'models rb', kind: 'change' })
  await ui.press({ key: 'hit:app/models/user.rb' })
  const ed = 'editor:/repo/app/models/user.rb'
  expect(await ui.find({ key: ed })).toBeDefined()

  // Clearing the filter brings the tree back.
  await ui.input({ key: 'filter', text: '', kind: 'change' })
  expect(await ui.find({ key: 'row:/repo/app' })).toBeDefined()

  // Claude writing the open file reloads it, with a green note.
  await ui.key({ key: 'down', in: ed })
  await $.tool.call({ tool: 'Write', file_path: '/repo/app/models/user.rb', content: 'class Person\nend\n' })
  expect(await ui.find({ type: 'Text', text: /^Person$/, in: ed })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /Reloaded at .*Claude edited/ }))?.props.backgroundColor).toBe('green')

  // With unsaved edits the draft stays and a red note says the disk moved.
  await ui.key({ key: 'end', in: ed })
  await ui.key({ key: '!', in: ed })
  await $.tool.call({ tool: 'Write', file_path: '/repo/app/models/user.rb', content: 'class Other\nend\n' })
  expect(await ui.find({ type: 'Text', text: /^Person$/, in: ed })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Other$/, in: ed })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /changed this file on disk/ }))?.props.backgroundColor).toBe('red')

  // A new file under an open folder appears in the tree.
  await ui.press({ key: 'row:/repo/app' })
  TREE['/repo/app']!.push({ name: 'new.rb', kind: 'file' })
  await $.tool.call({ tool: 'Write', file_path: '/repo/app/new.rb', content: '1\n' })
  expect(await ui.find({ key: 'row:/repo/app/new.rb' })).toBeDefined()
  TREE['/repo/app']!.pop()
})

test('shows ignored folders when the option is on', { options: { showIgnored: true } }, async ($, on) => {
  const ui = await mountTree($, on, {})
  expect(await ui.find({ key: 'row:/repo/.git' })).toBeDefined()
  expect(await ui.find({ key: 'row:/repo/node_modules' })).toBeDefined()
})

test('ctrl+f finds in the open file and marks the matches', async ($, on) => {
  const ui = await mountTree($, on, { '/repo/app/main.rb': 'def hi # note\n  puts "x"\nend\n' })
  await ui.press({ key: 'row:/repo/app' })
  await ui.press({ key: 'row:/repo/app/main.rb' })
  const ed = 'editor:/repo/app/main.rb'

  await ui.key({ key: 'f', ctrl: true, in: ed })
  expect(await ui.find({ type: 'Text', text: /^find: ▏$/, in: ed })).toBeDefined()
  await ui.key({ key: 'x', in: ed })
  expect(await ui.find({ type: 'Text', text: /1 match · Ln 2, Col 9/, in: ed })).toBeDefined()
  // The match is marked, and the cursor sits on it.
  const mark = await ui.find({ type: 'Text', text: /^x$/, in: ed })
  expect(mark?.props.backgroundColor).toBe('yellow')
  expect(mark?.props.inverse).toBe(true)
  // Enter from the only match wraps round to it; a query with no match leaves the cursor.
  await ui.key({ key: 'return', in: ed })
  expect(await ui.find({ type: 'Text', text: /Ln 2, Col 9/, in: ed })).toBeDefined()
  await ui.key({ key: 'q', in: ed })
  expect(await ui.find({ type: 'Text', text: /^find: xq▏$/, in: ed })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /0 matches · Ln 2, Col 9/, in: ed })).toBeDefined()
  // Tab closes the bar; typing goes to the text again, and the file was never changed by the search.
  await ui.key({ key: 'tab', in: ed })
  expect(await ui.find({ type: 'Text', text: /^saved · Ln 2, Col 9/, in: ed })).toBeDefined()
  await ui.key({ key: 'e', in: ed })
  expect(await ui.find({ type: 'Text', text: /● unsaved/ })).toBeDefined()
})
