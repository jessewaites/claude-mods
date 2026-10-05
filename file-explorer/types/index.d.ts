export type TreeEntry = { name: string; kind: 'file' | 'dir' | 'other' }

/** Something the person asked for while the editor had unsaved changes. */
export type Pending = { kind: 'close' } | { kind: 'open'; path: string }

/** What the pane asks the editor to do; `n` grows so each ask is seen once. */
export type EditorRequest = { kind: 'revert'; n: number } | { kind: 'scroll'; by: number; n: number }

export type Explorer = {
  /** The directory the tree starts at (the session's cwd). */
  root: string
  /** Absolute paths of folders drawn open. */
  expanded: string[]
  /** Cached listings per absolute folder path. */
  listings: Record<string, TreeEntry[]>
  /** The tree filter's text; empty draws the tree, anything else draws the matching files. */
  filter: string
  /** Every file under the root as a relative path, built on the first filter; null until then. */
  index: string[] | null
  /** Whether the index stopped at its cap, so a miss may still exist on disk. */
  indexTruncated: boolean
  /** The file shown on the right, absolute; null when none. */
  selected: string | null
  /** That file's text, newlines normalized to \n; null when none or unreadable. */
  content: string | null
  /** The line ending the file used on disk, restored on save. */
  eol: '\n' | '\r\n'
  /** The editor's text as last typed; null when it matches `content`. */
  draft: string | null
  /** The last ask sent to the editor through its props. */
  request: EditorRequest | null
  /** What waits on the save-or-discard choice; null when nothing does. */
  pending: Pending | null
  /** A one-line banner under the file header: green for a success, red for a failure. */
  notice: { kind: 'ok' | 'error'; text: string } | null
}

export type EditorProps = { path: string; text: string; request: EditorRequest | null }

export type EditorMessage =
  | { type: 'save'; path: string; text: string }
  | { type: 'draft'; path: string; text: string }

declare module 'claude-code' {
  interface PluginState {
    'file-explorer': { explorer: Explorer }
  }
}

/** What the model hands the plugin's `open_file` tool. */
export type OpenFileInput = { path: string }

declare module 'claude-code' {
  interface McpToolInputs {
    /** Opens a file in the editor pane; the model resolves a described file to its path first. */
    'mcp__file-explorer__open_file': OpenFileInput
  }
}
