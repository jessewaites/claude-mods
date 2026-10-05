// Minimal typing for the vendored highlight.js core (hooks/vendor/highlight/core.js),
// covering only what hooks/highlight.ts calls.
export type Language = { name?: string; aliases?: string[]; disableAutodetect?: boolean; [key: string]: unknown }
export type LanguageFn = (hljs: HLJSApi) => Language

export type HighlightResult = {
  value: string
  language?: string
  relevance: number
  illegal: boolean
}

export type HLJSApi = {
  highlight(code: string, options: { language: string; ignoreIllegals?: boolean }): HighlightResult
  registerLanguage(name: string, language: LanguageFn): void
  registerAliases(aliases: string | string[], options: { languageName: string }): void
  getLanguage(name: string): Language | undefined
  listLanguages(): string[]
  configure(options: { classPrefix?: string; ignoreUnescapedHTML?: boolean; throwUnescapedHTML?: boolean }): void
  versionString: string
}

declare const highlight: HLJSApi
export default highlight
