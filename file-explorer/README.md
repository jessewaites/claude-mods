# file-explorer — a Claude Code mod

MIT licensed; part of [claude-mods](https://github.com/jessewaites/claude-mods).

GitHub-style file tree on the left, a text editor on the right, inside a Claude Code pane.
Made for quick manual edits (fix a period, add an exclamation point) without opening an editor
or spending tokens asking Claude to do it.

## Install

```sh
claude plugin marketplace add jessewaites/claude-mods
claude plugin install file-explorer@claude-mods
```

Works in the terminal and the desktop app (the editor needs a surface that draws a `Client`;
VS Code and mobile get a read-only view). Or try it from a checkout without installing:

```sh
cd ~/your-project
claude --plugin-dir ~/Code/claude_mods/file-explorer
```

## Use it

- `/editor` opens the pane. `/editor app/views/home.html.erb` opens straight to a file.
- Or just type `open the editor` / `hey claude, please open the file explorer` as a prompt.
  Prompts that ask for nothing else open the pane and never reach the model.
- Describe a file and Claude opens it: `open the user show page in the editor`. The plugin gives
  the model an `open_file` tool; it finds the path (Glob, Grep) and calls it, so nobody crawls the tree.
- The transcript gets a dim `Editor opened.` / `Editor closed.` line.

In the pane (Tab / arrows / click move between rows; Enter presses):

- Click or Enter on a folder to expand it, on a file to open it in the editor.
- The box above the tree filters the whole project by name: every word you type must appear in
  the path (`models rb`). Enter opens the first match. The index is built on the first filter and
  stops at 5,000 files; refresh rebuilds it.
- `.git`, `node_modules`, caches and the like are hidden. The plugin option "Show ignored
  folders" (in `/config`, or `pluginConfigs` in settings) lists them.
- When Claude edits a file with Edit, Write or NotebookEdit, the tree and the open file follow:
  a clean file reloads with a green note; one with unsaved edits keeps them and shows a red note.
- The mouse wheel scrolls the editor when the pointer is over it, and the tree otherwise.
- Every control sits on the header row: `save` · `revert` · `refresh` · `x close` (Esc also closes).
  `r` and `x` work as hotkeys while no file is open; with a file open the keys go to the editor.
- Click into the editor to type. Arrows, Home/End, PgUp/PgDn, Tab (4 spaces),
  Enter keeps indentation.
  - `ctrl+s` saves (or the `save` button). `ctrl+z` undo, `ctrl+y` redo (a run of typing is one step).
  - `revert` puts the saved text back (undoable). The header shows `● unsaved` while there are changes.
  - `ctrl+f` opens find: type to jump to the first match from the cursor, Enter or ↓ for the next,
    ↑ for the previous, Tab to close. Matches are marked in yellow. `ctrl+g` repeats the last search.
  - After a save a banner appears under the file name: green with a ✓ when it wrote, red with a ✗
    when it failed (the toast says the same, with the same mark).
  - Leaving with unsaved changes (`x close`, or clicking another file) asks:
    save and continue / discard / keep editing.
  - Esc only hands the keyboard back; it never loses your edits.
  - Code is syntax-coloured in the editor by file type (about 110 languages, by file name,
    extension or shebang; the status line names the one in use). Unknown types are drawn plain.
    Files over 200k characters are drawn plain too.

## Files

- `hooks/register.tsx` — the hooks: `/editor`, the phrase, the `open_file` tool, the pane drawing, save handling.
- `hooks/editor.tsx` — the editor, a `Client` surface module that handles keys locally, finds in the text and posts `save`.
- `hooks/highlight.ts` — language detection for a path, the colour theme, and a tokenizer over highlight.js.
- `hooks/vendor/highlight/` — highlight.js 11.12 core (built as an ES module) and its grammars, BSD-3-Clause (see its LICENSE).
- `types/index.d.ts` — the `$.state` contract.
- `tests/explorer.test.tsx` — `claude plugin test ~/Code/claude_mods/file-explorer`.
