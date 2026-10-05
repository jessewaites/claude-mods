// Syntax colouring for the editor, on a vendored highlight.js (hooks/vendor/highlight,
// BSD-3-Clause). The engine's own highlighter draws the read-only <Code> view; the
// editor draws its own Texts, so it tokenizes here and colours each run itself.
//
// Colours are the terminal's named ANSI colours, so they follow the person's theme.

import hljs from './vendor/highlight/core.js'
import type { LanguageFn } from './vendor/highlight/core.js'

import lang_accesslog from './vendor/highlight/languages/accesslog.js'
import lang_actionscript from './vendor/highlight/languages/actionscript.js'
import lang_ada from './vendor/highlight/languages/ada.js'
import lang_apache from './vendor/highlight/languages/apache.js'
import lang_applescript from './vendor/highlight/languages/applescript.js'
import lang_arduino from './vendor/highlight/languages/arduino.js'
import lang_armasm from './vendor/highlight/languages/armasm.js'
import lang_asciidoc from './vendor/highlight/languages/asciidoc.js'
import lang_autohotkey from './vendor/highlight/languages/autohotkey.js'
import lang_awk from './vendor/highlight/languages/awk.js'
import lang_bash from './vendor/highlight/languages/bash.js'
import lang_basic from './vendor/highlight/languages/basic.js'
import lang_c from './vendor/highlight/languages/c.js'
import lang_capnproto from './vendor/highlight/languages/capnproto.js'
import lang_clojure from './vendor/highlight/languages/clojure.js'
import lang_cmake from './vendor/highlight/languages/cmake.js'
import lang_coffeescript from './vendor/highlight/languages/coffeescript.js'
import lang_cpp from './vendor/highlight/languages/cpp.js'
import lang_crystal from './vendor/highlight/languages/crystal.js'
import lang_csharp from './vendor/highlight/languages/csharp.js'
import lang_css from './vendor/highlight/languages/css.js'
import lang_d from './vendor/highlight/languages/d.js'
import lang_dart from './vendor/highlight/languages/dart.js'
import lang_diff from './vendor/highlight/languages/diff.js'
import lang_django from './vendor/highlight/languages/django.js'
import lang_dockerfile from './vendor/highlight/languages/dockerfile.js'
import lang_dos from './vendor/highlight/languages/dos.js'
import lang_elixir from './vendor/highlight/languages/elixir.js'
import lang_elm from './vendor/highlight/languages/elm.js'
import lang_erb from './vendor/highlight/languages/erb.js'
import lang_erlang from './vendor/highlight/languages/erlang.js'
import lang_excel from './vendor/highlight/languages/excel.js'
import lang_fortran from './vendor/highlight/languages/fortran.js'
import lang_fsharp from './vendor/highlight/languages/fsharp.js'
import lang_gcode from './vendor/highlight/languages/gcode.js'
import lang_gherkin from './vendor/highlight/languages/gherkin.js'
import lang_glsl from './vendor/highlight/languages/glsl.js'
import lang_go from './vendor/highlight/languages/go.js'
import lang_gradle from './vendor/highlight/languages/gradle.js'
import lang_graphql from './vendor/highlight/languages/graphql.js'
import lang_groovy from './vendor/highlight/languages/groovy.js'
import lang_haml from './vendor/highlight/languages/haml.js'
import lang_handlebars from './vendor/highlight/languages/handlebars.js'
import lang_haskell from './vendor/highlight/languages/haskell.js'
import lang_http from './vendor/highlight/languages/http.js'
import lang_ini from './vendor/highlight/languages/ini.js'
import lang_java from './vendor/highlight/languages/java.js'
import lang_javascript from './vendor/highlight/languages/javascript.js'
import lang_json from './vendor/highlight/languages/json.js'
import lang_julia from './vendor/highlight/languages/julia.js'
import lang_kotlin from './vendor/highlight/languages/kotlin.js'
import lang_latex from './vendor/highlight/languages/latex.js'
import lang_less from './vendor/highlight/languages/less.js'
import lang_lisp from './vendor/highlight/languages/lisp.js'
import lang_llvm from './vendor/highlight/languages/llvm.js'
import lang_lua from './vendor/highlight/languages/lua.js'
import lang_makefile from './vendor/highlight/languages/makefile.js'
import lang_markdown from './vendor/highlight/languages/markdown.js'
import lang_matlab from './vendor/highlight/languages/matlab.js'
import lang_mipsasm from './vendor/highlight/languages/mipsasm.js'
import lang_nestedtext from './vendor/highlight/languages/nestedtext.js'
import lang_nginx from './vendor/highlight/languages/nginx.js'
import lang_nim from './vendor/highlight/languages/nim.js'
import lang_nix from './vendor/highlight/languages/nix.js'
import lang_node_repl from './vendor/highlight/languages/node-repl.js'
import lang_objectivec from './vendor/highlight/languages/objectivec.js'
import lang_ocaml from './vendor/highlight/languages/ocaml.js'
import lang_perl from './vendor/highlight/languages/perl.js'
import lang_pgsql from './vendor/highlight/languages/pgsql.js'
import lang_php_template from './vendor/highlight/languages/php-template.js'
import lang_php from './vendor/highlight/languages/php.js'
import lang_plaintext from './vendor/highlight/languages/plaintext.js'
import lang_powershell from './vendor/highlight/languages/powershell.js'
import lang_processing from './vendor/highlight/languages/processing.js'
import lang_prolog from './vendor/highlight/languages/prolog.js'
import lang_properties from './vendor/highlight/languages/properties.js'
import lang_protobuf from './vendor/highlight/languages/protobuf.js'
import lang_puppet from './vendor/highlight/languages/puppet.js'
import lang_python_repl from './vendor/highlight/languages/python-repl.js'
import lang_python from './vendor/highlight/languages/python.js'
import lang_qml from './vendor/highlight/languages/qml.js'
import lang_r from './vendor/highlight/languages/r.js'
import lang_reasonml from './vendor/highlight/languages/reasonml.js'
import lang_ruby from './vendor/highlight/languages/ruby.js'
import lang_rust from './vendor/highlight/languages/rust.js'
import lang_scala from './vendor/highlight/languages/scala.js'
import lang_scheme from './vendor/highlight/languages/scheme.js'
import lang_scss from './vendor/highlight/languages/scss.js'
import lang_shell from './vendor/highlight/languages/shell.js'
import lang_smalltalk from './vendor/highlight/languages/smalltalk.js'
import lang_sml from './vendor/highlight/languages/sml.js'
import lang_sql from './vendor/highlight/languages/sql.js'
import lang_stylus from './vendor/highlight/languages/stylus.js'
import lang_swift from './vendor/highlight/languages/swift.js'
import lang_tcl from './vendor/highlight/languages/tcl.js'
import lang_thrift from './vendor/highlight/languages/thrift.js'
import lang_twig from './vendor/highlight/languages/twig.js'
import lang_typescript from './vendor/highlight/languages/typescript.js'
import lang_vbnet from './vendor/highlight/languages/vbnet.js'
import lang_vbscript_html from './vendor/highlight/languages/vbscript-html.js'
import lang_vbscript from './vendor/highlight/languages/vbscript.js'
import lang_verilog from './vendor/highlight/languages/verilog.js'
import lang_vhdl from './vendor/highlight/languages/vhdl.js'
import lang_vim from './vendor/highlight/languages/vim.js'
import lang_wasm from './vendor/highlight/languages/wasm.js'
import lang_x86asm from './vendor/highlight/languages/x86asm.js'
import lang_xml from './vendor/highlight/languages/xml.js'
import lang_xquery from './vendor/highlight/languages/xquery.js'
import lang_yaml from './vendor/highlight/languages/yaml.js'

export type Style = { color?: string; bold?: boolean; italic?: boolean; dim?: boolean; underline?: boolean }
export type Token = { text: string; style: Style | null }
/** One line of the source as styled runs; a `null` style is the default text. */
export type Line = Token[]

const LANGUAGES: Array<[string, LanguageFn]> = [
  ['accesslog', lang_accesslog],
  ['actionscript', lang_actionscript],
  ['ada', lang_ada],
  ['apache', lang_apache],
  ['applescript', lang_applescript],
  ['arduino', lang_arduino],
  ['armasm', lang_armasm],
  ['asciidoc', lang_asciidoc],
  ['autohotkey', lang_autohotkey],
  ['awk', lang_awk],
  ['bash', lang_bash],
  ['basic', lang_basic],
  ['c', lang_c],
  ['capnproto', lang_capnproto],
  ['clojure', lang_clojure],
  ['cmake', lang_cmake],
  ['coffeescript', lang_coffeescript],
  ['cpp', lang_cpp],
  ['crystal', lang_crystal],
  ['csharp', lang_csharp],
  ['css', lang_css],
  ['d', lang_d],
  ['dart', lang_dart],
  ['diff', lang_diff],
  ['django', lang_django],
  ['dockerfile', lang_dockerfile],
  ['dos', lang_dos],
  ['elixir', lang_elixir],
  ['elm', lang_elm],
  ['erb', lang_erb],
  ['erlang', lang_erlang],
  ['excel', lang_excel],
  ['fortran', lang_fortran],
  ['fsharp', lang_fsharp],
  ['gcode', lang_gcode],
  ['gherkin', lang_gherkin],
  ['glsl', lang_glsl],
  ['go', lang_go],
  ['gradle', lang_gradle],
  ['graphql', lang_graphql],
  ['groovy', lang_groovy],
  ['haml', lang_haml],
  ['handlebars', lang_handlebars],
  ['haskell', lang_haskell],
  ['http', lang_http],
  ['ini', lang_ini],
  ['java', lang_java],
  ['javascript', lang_javascript],
  ['json', lang_json],
  ['julia', lang_julia],
  ['kotlin', lang_kotlin],
  ['latex', lang_latex],
  ['less', lang_less],
  ['lisp', lang_lisp],
  ['llvm', lang_llvm],
  ['lua', lang_lua],
  ['makefile', lang_makefile],
  ['markdown', lang_markdown],
  ['matlab', lang_matlab],
  ['mipsasm', lang_mipsasm],
  ['nestedtext', lang_nestedtext],
  ['nginx', lang_nginx],
  ['nim', lang_nim],
  ['nix', lang_nix],
  ['node-repl', lang_node_repl],
  ['objectivec', lang_objectivec],
  ['ocaml', lang_ocaml],
  ['perl', lang_perl],
  ['pgsql', lang_pgsql],
  ['php-template', lang_php_template],
  ['php', lang_php],
  ['plaintext', lang_plaintext],
  ['powershell', lang_powershell],
  ['processing', lang_processing],
  ['prolog', lang_prolog],
  ['properties', lang_properties],
  ['protobuf', lang_protobuf],
  ['puppet', lang_puppet],
  ['python-repl', lang_python_repl],
  ['python', lang_python],
  ['qml', lang_qml],
  ['r', lang_r],
  ['reasonml', lang_reasonml],
  ['ruby', lang_ruby],
  ['rust', lang_rust],
  ['scala', lang_scala],
  ['scheme', lang_scheme],
  ['scss', lang_scss],
  ['shell', lang_shell],
  ['smalltalk', lang_smalltalk],
  ['sml', lang_sml],
  ['sql', lang_sql],
  ['stylus', lang_stylus],
  ['swift', lang_swift],
  ['tcl', lang_tcl],
  ['thrift', lang_thrift],
  ['twig', lang_twig],
  ['typescript', lang_typescript],
  ['vbnet', lang_vbnet],
  ['vbscript-html', lang_vbscript_html],
  ['vbscript', lang_vbscript],
  ['verilog', lang_verilog],
  ['vhdl', lang_vhdl],
  ['vim', lang_vim],
  ['wasm', lang_wasm],
  ['x86asm', lang_x86asm],
  ['xml', lang_xml],
  ['xquery', lang_xquery],
  ['yaml', lang_yaml],
]
for (const [name, language] of LANGUAGES) hljs.registerLanguage(name, language)
hljs.configure({ ignoreUnescapedHTML: true })

/** Texts past this many characters are drawn plain: a keystroke re-tokenizes the prefix. */
export const HIGHLIGHT_LIMIT = 200_000

/** Whole file names highlight.js has no alias for. */
const BY_NAME: Record<string, string> = {
  dockerfile: 'dockerfile',
  containerfile: 'dockerfile',
  makefile: 'makefile',
  gnumakefile: 'makefile',
  'cmakelists.txt': 'cmake',
  gemfile: 'ruby',
  rakefile: 'ruby',
  guardfile: 'ruby',
  podfile: 'ruby',
  brewfile: 'ruby',
  vagrantfile: 'ruby',
  fastfile: 'ruby',
  jenkinsfile: 'groovy',
  'build.gradle': 'gradle',
  'settings.gradle': 'gradle',
  '.bashrc': 'bash',
  '.bash_profile': 'bash',
  '.zshrc': 'bash',
  '.zshenv': 'bash',
  '.zprofile': 'bash',
  '.profile': 'bash',
  '.vimrc': 'vim',
  '.gitconfig': 'ini',
  '.gitmodules': 'ini',
  '.editorconfig': 'ini',
  '.npmrc': 'ini',
  '.env': 'properties',
  '.htaccess': 'apache',
  'nginx.conf': 'nginx',
}

/** Extensions highlight.js has no alias for, or maps elsewhere than a file of that name usually is. */
const BY_EXT: Record<string, string> = {
  erb: 'erb',
  rhtml: 'erb',
  gemspec: 'ruby',
  rake: 'ruby',
  ru: 'ruby',
  jbuilder: 'ruby',
  podspec: 'ruby',
  thor: 'ruby',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  h: 'c',
  hpp: 'cpp',
  hh: 'cpp',
  hxx: 'cpp',
  cxx: 'cpp',
  cc: 'cpp',
  mm: 'objectivec',
  kts: 'kotlin',
  toml: 'ini',
  cfg: 'ini',
  conf: 'ini',
  env: 'properties',
  htm: 'xml',
  xhtml: 'xml',
  xsl: 'xml',
  xsd: 'xml',
  plist: 'xml',
  vue: 'xml',
  svelte: 'xml',
  astro: 'xml',
  csproj: 'xml',
  storyboard: 'xml',
  xib: 'xml',
  jsonc: 'json',
  json5: 'json',
  webmanifest: 'json',
  geojson: 'json',
  mdx: 'markdown',
  rmd: 'markdown',
  fish: 'bash',
  ksh: 'bash',
  bat: 'dos',
  cmd: 'dos',
  psm1: 'powershell',
  psd1: 'powershell',
  pyi: 'python',
  pyw: 'python',
  heex: 'xml',
  eex: 'erb',
  lhs: 'haskell',
  ml: 'ocaml',
  mli: 'ocaml',
  fsx: 'fsharp',
  fsi: 'fsharp',
  cljc: 'clojure',
  edn: 'clojure',
  rkt: 'scheme',
  el: 'lisp',
  sty: 'latex',
  cls: 'latex',
  bib: 'latex',
  t: 'perl',
  phtml: 'php-template',
  sc: 'scala',
  sbt: 'scala',
  mustache: 'handlebars',
  njk: 'django',
  jinja: 'django',
  jinja2: 'django',
  j2: 'django',
  gql: 'graphql',
  psql: 'pgsql',
  vimrc: 'vim',
  sv: 'verilog',
  svh: 'verilog',
  vhd: 'vhdl',
  asm: 'x86asm',
  s: 'armasm',
  vert: 'glsl',
  frag: 'glsl',
  geom: 'glsl',
  patch: 'diff',
  rej: 'diff',
  styl: 'stylus',
  f: 'fortran',
  f90: 'fortran',
  f95: 'fortran',
  bas: 'basic',
  as: 'actionscript',
  scpt: 'applescript',
  ino: 'arduino',
  adoc: 'asciidoc',
  ahk: 'autohotkey',
  adb: 'ada',
  ads: 'ada',
  feature: 'gherkin',
  ll: 'llvm',
  pde: 'processing',
  re: 'reasonml',
  rei: 'reasonml',
  vbs: 'vbscript',
  xq: 'xquery',
  xqm: 'xquery',
  nt: 'nestedtext',
  nc: 'gcode',
  capnp: 'capnproto',
  txt: 'plaintext',
  text: 'plaintext',
}

const SHEBANGS: Array<[RegExp, string]> = [
  [/\b(ba|z|k|da)?sh\b/, 'bash'],
  [/\bpython[0-9.]*\b/, 'python'],
  [/\bruby\b/, 'ruby'],
  [/\b(node|deno|bun)\b/, 'javascript'],
  [/\bperl\b/, 'perl'],
  [/\bphp\b/, 'php'],
  [/\b(lua|luajit)\b/, 'lua'],
  [/\belixir\b/, 'elixir'],
  [/\bpwsh\b/, 'powershell'],
]

/** Each registered grammar by object, so an alias (`rb`) resolves to its id (`ruby`). */
const IDS = new Map(hljs.listLanguages().map(id => [hljs.getLanguage(id), id] as const))

/** The id of the language `name` names, by id or alias; null when none does. */
const known = (name: string | undefined): string | null => {
  if (!name) return null
  const language = hljs.getLanguage(name)
  return language ? (IDS.get(language) ?? name) : null
}

/**
 * The highlight.js language for a file: by its name, then its extension (the
 * plugin's table, then highlight.js's own aliases), then a shebang on the first
 * line. `null` when none resolves, and the editor draws plain text.
 */
export const languageFor = (path: string, firstLine = ''): string | null => {
  const base = path.slice(path.lastIndexOf('/') + 1).toLowerCase()
  if (base.startsWith('.env')) return known('properties')
  const byName = known(BY_NAME[base])
  if (byName) return byName

  const dot = base.lastIndexOf('.')
  if (dot > 0) {
    const ext = base.slice(dot + 1)
    const hit = known(BY_EXT[ext]) ?? known(ext)
    if (hit) return hit
  }

  if (firstLine.startsWith('#!')) {
    for (const [re, name] of SHEBANGS) if (re.test(firstLine)) return known(name)
  }
  return null
}

/** Colours per highlight.js scope. A dotted scope falls back to its prefix, then the default. */
const THEME: Record<string, Style | null> = {
  keyword: { color: 'magenta' },
  built_in: { color: 'cyan' },
  type: { color: 'yellow' },
  literal: { color: 'yellow' },
  number: { color: 'yellow' },
  operator: null,
  punctuation: null,
  property: { color: 'cyan' },
  regexp: { color: 'red' },
  string: { color: 'green' },
  'char.escape': { color: 'cyan' },
  subst: null,
  symbol: { color: 'cyan' },
  class: { color: 'yellow' },
  function: null,
  variable: null,
  'variable.language': { color: 'red' },
  'variable.constant': { color: 'yellow' },
  title: { color: 'blue' },
  'title.class': { color: 'yellow', bold: true },
  'title.class.inherited': { color: 'yellow' },
  'title.function': { color: 'blue' },
  'title.function.invoke': { color: 'blue' },
  params: null,
  comment: { dim: true },
  doctag: { dim: true, bold: true },
  meta: { color: 'cyan', dim: true },
  'meta.prompt': { dim: true },
  'meta.keyword': { color: 'cyan' },
  'meta.string': { color: 'green' },
  section: { color: 'yellow', bold: true },
  tag: null,
  name: { color: 'blue' },
  attr: { color: 'cyan' },
  attribute: { color: 'cyan' },
  bullet: { color: 'yellow' },
  code: { color: 'green' },
  emphasis: { italic: true },
  strong: { bold: true },
  formula: { color: 'cyan' },
  link: { color: 'cyan', underline: true },
  quote: { dim: true, italic: true },
  'selector-tag': { color: 'blue' },
  'selector-id': { color: 'yellow' },
  'selector-class': { color: 'yellow' },
  'selector-attr': { color: 'cyan' },
  'selector-pseudo': { color: 'cyan' },
  'template-tag': { color: 'magenta' },
  'template-variable': { color: 'yellow' },
  addition: { color: 'green' },
  deletion: { color: 'red' },
}

/**
 * The style for a span's class list: `hljs-title function_` is the scope
 * `title.function`, looked up whole, then by shorter prefixes. A sublanguage
 * span (`language-xml`) and an unknown scope keep the enclosing style.
 */
const styleFor = (classes: string, parent: Style | null): Style | null => {
  const parts = classes.split(/\s+/).filter(Boolean)
  const head = parts[0]
  if (!head || !head.startsWith('hljs-')) return parent
  const scope = [head.slice(5), ...parts.slice(1).map(p => p.replace(/_+$/, ''))]
  for (let n = scope.length; n > 0; n--) {
    const key = scope.slice(0, n).join('.')
    if (key in THEME) return THEME[key] ?? null
  }
  return parent
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'" }
const unescape = (s: string) => s.replace(/&(?:amp|lt|gt|quot|#x27);/g, m => ENTITIES[m] ?? m)

const sameStyle = (a: Style | null, b: Style | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.color === b.color &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.dim === b.dim &&
    a.underline === b.underline)

/** `text` as unstyled lines. */
export const plain = (text: string): Line[] => text.split('\n').map(line => (line ? [{ text: line, style: null }] : []))

/**
 * Tokenizes `text` in `language`: one `Line` per line of the text, runs merged
 * where their style matches. Falls back to plain lines when highlight.js
 * throws (a grammar bug on this input) or the text is over HIGHLIGHT_LIMIT.
 */
export const tokenize = (text: string, language: string): Line[] => {
  if (text.length > HIGHLIGHT_LIMIT) return plain(text)
  let html: string
  try {
    html = hljs.highlight(text, { language, ignoreIllegals: true }).value
  } catch {
    return plain(text)
  }

  const lines: Line[] = [[]]
  const stack: Array<Style | null> = []
  let current: Line = lines[0]!
  const push = (piece: string, style: Style | null) => {
    if (!piece) return
    const last = current[current.length - 1]
    if (last && sameStyle(last.style, style)) last.text += piece
    else current.push({ text: piece, style })
  }

  const re = /<span class="([^"]*)">|<\/span>|([^<]+)/g
  for (let m = re.exec(html); m !== null; m = re.exec(html)) {
    if (m[1] !== undefined) {
      stack.push(styleFor(m[1], stack[stack.length - 1] ?? null))
    } else if (m[2] !== undefined) {
      const style = stack[stack.length - 1] ?? null
      const parts = unescape(m[2]).split('\n')
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          current = []
          lines.push(current)
        }
        push(parts[i]!, style)
      }
    } else {
      stack.pop()
    }
  }
  return lines
}
