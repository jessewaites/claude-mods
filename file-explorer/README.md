# file-explorer

A file tree and a syntax-coloured text editor in a Claude Code pane.

![Asked for "the blog post index page in the text editor", Claude found src/pages/blog/[...page].astro and opened it in the pane beside the transcript](./assets/editor.png)

For the small edits that aren't worth a prompt: fix a typo, change a label, tweak a value.
Open the file, type, `ctrl+s`, carry on. Claude never sees it and no tokens are spent.

- **Ask for a file in plain words.** "Open the user show page in the editor" and Claude finds
  the path and opens it. The plugin gives the model an `open_file` tool for exactly this.
- **Syntax colouring** for about 110 languages, in your terminal's own colours.
- **Follows Claude's edits.** When Claude changes the file you have open, the editor reloads it.
- **Find in file**, undo and redo, a project-wide filename filter, and a safety prompt
  before you lose unsaved changes.

Runs in the Claude Code terminal and desktop app. VS Code and mobile get a read-only view.

## Install

```sh
claude plugin marketplace add jessewaites/claude-mods
claude plugin install file-explorer@claude-mods
```

Update later with `claude plugin update file-explorer@claude-mods`.

## Open it

| You type | What happens |
| --- | --- |
| `/editor` | Opens the pane with the project tree. |
| `/editor app/models/user.rb` | Opens the pane straight onto that file. |
| `open the editor` | Same as `/editor`. A short prompt that asks for nothing else opens the pane and never reaches the model. |
| `open the user show page in the editor` | Reaches Claude, who finds the file and opens it with the `open_file` tool. |

The transcript gets one dim line when the pane opens and one when it closes.

## Use it

**The tree.** Click a folder or press Enter on it to expand it; a file opens in the editor.
Tab and the arrow keys move between rows. The box above the tree filters the whole project
by name: every word you type must appear in the path, so `models rb` finds `app/models/user.rb`.
Enter opens the first match.

**The editor.** Click into it to type. All the controls sit on the header row:
`save`, `revert`, `refresh`, `x close`.

| Key | Action |
| --- | --- |
| `ctrl+s` | Save |
| `ctrl+z` / `ctrl+y` | Undo / redo (a run of typing is one step) |
| `ctrl+f` | Find: type to jump to the first match, Enter or ↓ next, ↑ previous, Tab closes |
| `ctrl+g` | Next match of the last search |
| Arrows, Home, End, PgUp, PgDn | Move; the mouse wheel scrolls too |
| Tab | Four spaces |
| Enter | New line, keeping the indentation |
| Esc | Hands the keyboard back to the pane; your edits stay |
| `r` / `x` | Refresh / close, while no file is open |

A banner under the header reports each save: green with a ✓ when it wrote, red with a ✗ when
it failed. The header shows `● unsaved` while there are changes, and leaving the file with
changes (closing, or opening another) asks first: save and continue, discard, or keep editing.

**When Claude edits.** After Claude's Edit, Write or NotebookEdit lands, the tree re-lists the
folder and a clean editor reloads the file with a green note. An editor with unsaved changes
keeps them and shows a red note that the disk moved.

## Configuration

`.git`, `node_modules`, `.DS_Store`, `__pycache__`, `.venv`, `.next`, `.idea` and similar
folders are hidden from the tree and the filter. Turn on **Show ignored folders** in `/config`
to list them, or in settings:

```json
{ "pluginConfigs": { "file-explorer": { "showIgnored": true } } }
```

## Limits worth knowing

- Files over 200,000 characters open without colouring. Colouring runs over the text up to the
  visible window on each keystroke, which is fast enough for source files but not for logs.
- The filename filter indexes up to 5,000 files, skipping ignored folders. `refresh` rebuilds it.
- Line endings are preserved (`CRLF` files save as `CRLF`). Tabs display as four spaces.
- The pane asks for 120 columns by 40 rows and shrinks to what the terminal has; the tree
  takes about a third of the width.

## How it works

The plugin runs inside Claude Code's hook engine, not as a separate process. It reads and
writes files through the engine's `$.fs` API, draws the pane with a `ui.render` hook, and
runs the editor as a `Client` surface module that handles keys locally and posts saves back.
It does not watch the filesystem; it reacts to Claude's edits through a `tool.call` hook and
otherwise re-reads on `refresh`.

Colouring is a vendored [highlight.js](https://highlightjs.org/) 11.12, built as ES modules
because plugin code cannot import from npm or the network. Its tokens are mapped onto the
terminal's named ANSI colours, so they follow whatever theme the terminal uses.

## Development

```sh
git clone git@github.com:jessewaites/claude-mods.git
cd ~/some-project
claude --plugin-dir ~/claude-mods/file-explorer   # loads it for this session, hot-reloading on save
```

```sh
claude plugin validate --strict ./file-explorer
claude plugin test ./file-explorer
```

| File | Role |
| --- | --- |
| `hooks/register.tsx` | The hooks: `/editor`, the open phrase, the `open_file` tool, the pane, saving, the Claude-edit reload |
| `hooks/editor.tsx` | The editor surface module: keys, cursor, undo, find, drawing |
| `hooks/highlight.ts` | Language detection by file name, extension or shebang; the colour theme; the tokenizer |
| `hooks/vendor/highlight/` | highlight.js core and grammars (BSD-3-Clause, licence included) |
| `types/index.d.ts` | The `$.state` contract and the `open_file` tool's input type |
| `tests/explorer.test.tsx` | The test suite |

To add a language, copy its file from highlight.js's `es/languages/` into
`hooks/vendor/highlight/languages/`, add a matching `.d.ts` stub, and list it in `hooks/highlight.ts`.

## License

MIT. Part of [claude-mods](https://github.com/jessewaites/claude-mods).
