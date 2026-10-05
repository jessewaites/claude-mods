# claude-mods

Claude Code mods by Jesse Waites: plugins of function hooks that add live panes
and tools to Claude Code in the terminal and the desktop app.

## Install

```sh
claude plugin marketplace add jessewaites/claude-mods
claude plugin install file-explorer@claude-mods
```

Updates: `claude plugin update file-explorer@claude-mods`.

## Plugins

| Plugin | What it does |
| --- | --- |
| [file-explorer](./file-explorer) | A file tree and syntax-coloured text editor in a pane. `/editor`, say "open the editor", or ask Claude to "open the user show page in the editor" and it finds the file and opens it. Quick manual edits without leaving the session. |

## Developing

Each plugin is a folder with `.claude-plugin/plugin.json`. Try one from a real project without installing it:

```sh
cd ~/some-project
claude --plugin-dir ~/Code/claude_mods/file-explorer
```

Check a plugin before a release:

```sh
claude plugin validate --strict ./file-explorer
claude plugin test ./file-explorer
```

## License

MIT. `file-explorer` vendors [highlight.js](https://highlightjs.org/) (BSD-3-Clause, licence included alongside it).
