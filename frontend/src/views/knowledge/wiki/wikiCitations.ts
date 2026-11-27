import {
  extractCitationHtmlPlaceholders,
  joinCitationTagsToPreviousLine,
  restoreCitationHtmlPlaceholders,
} from '../../../utils/citationMarkdown.ts'

// Wiki pages accept the chat's `<kb doc="…" chunk_id="…"/>` (and `<web/>`)
// citation tags. They become the same inline citation markers as in a chat
// answer and stay out of the Markdown parser, which would mangle their
// attributes; a tag on a line of its own joins the passage above it.
export function renderWithCitations(markdown: string, render: (markdown: string) => string): string {
  const { content, htmlSnippets } = extractCitationHtmlPlaceholders(joinCitationTagsToPreviousLine(markdown))
  return restoreCitationHtmlPlaceholders(render(content), htmlSnippets)
}
