import {
  extractCitationHtmlPlaceholders,
  joinCitationTagsToPreviousLine,
  restoreCitationHtmlPlaceholders,
} from '../../../utils/citationMarkdown.ts'
import type { KnowledgeReferenceLike } from '../../../utils/referenceSources.ts'
import type { SourceLocator } from '../../../utils/sourceLocator.ts'

// Wiki pages accept the chat's `<kb doc="…" chunk_id="…"/>` (and `<web/>`)
// citation tags. They become the same inline citation markers as in a chat
// answer and stay out of the Markdown parser, which would mangle their
// attributes; a tag on a line of its own joins the passage above it.
export function renderWithCitations(markdown: string, render: (markdown: string) => string): string {
  const { content, htmlSnippets } = extractCitationHtmlPlaceholders(joinCitationTagsToPreviousLine(markdown))
  return restoreCitationHtmlPlaceholders(render(content), htmlSnippets)
}

/** The fields of a chunk (GET /chunks/by-id/:id) that place it in its document. */
export type CitedChunk = {
  id?: string
  knowledge_id?: string
  knowledge_base_id?: string
  chunk_index?: number
  chunk_type?: string
  content?: string
  source_locators?: SourceLocator[]
}

/**
 * A cited chunk as a references-panel entry. Unlike a chat answer, a wiki page
 * carries no reference list, so the citation's `doc` label names the document.
 */
export function citationReference(chunk: CitedChunk | null | undefined, doc: string): KnowledgeReferenceLike | null {
  if (!chunk?.id || !chunk.knowledge_id) return null
  return {
    id: chunk.id,
    knowledge_id: chunk.knowledge_id,
    knowledge_base_id: chunk.knowledge_base_id,
    knowledge_title: doc,
    chunk_index: chunk.chunk_index,
    chunk_type: chunk.chunk_type,
    content: chunk.content,
    source_locators: chunk.source_locators,
  }
}

/**
 * Loads each cited chunk once. A missing chunk resolves to null and stays
 * cached; a failed request is retried on the next citation that needs it.
 */
export function createCitationReferenceLoader(
  fetchChunk: (chunkId: string) => Promise<{ data?: CitedChunk } | undefined>,
) {
  const cache = new Map<string, Promise<KnowledgeReferenceLike | null>>()
  return (chunkId: string, doc: string): Promise<KnowledgeReferenceLike | null> => {
    let pending = cache.get(chunkId)
    if (!pending) {
      pending = fetchChunk(chunkId).then(
        (res) => citationReference(res?.data, doc),
        (error: { status?: unknown; $httpStatus?: unknown } | null) => {
          if ((error?.$httpStatus ?? error?.status) !== 404) cache.delete(chunkId)
          return null
        },
      )
      cache.set(chunkId, pending)
    }
    return pending
  }
}
