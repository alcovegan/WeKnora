import assert from 'node:assert/strict'
import test from 'node:test'

import { marked } from 'marked'

import { citationReference, createCitationReferenceLoader, renderWithCitations } from './wikiCitations.ts'

const render = (md: string) =>
  renderWithCitations(md, (content) => marked.parse(content, { breaks: true, async: false }) as string)

test('kb tags become inline citation markers', () => {
  const html = render('Pure functions *always* return the same result (p. 12 <kb doc="Sample Book" chunk_id="chunk-1" kb_id="kb-1"/>).')
  assert.match(html, /<em>always<\/em>/)
  assert.match(html, /<span class="citation citation-kb" data-kb-id="kb-1" data-chunk-id="chunk-1" data-doc="Sample Book"/)
  assert.match(html, /\(p\. 12 <span class="citation citation-kb"[^]*<\/span>\)\.<\/p>/)
})

test('a tag on its own line joins the passage above it', () => {
  const html = render('First claim.\n\n<kb doc="Book" chunk_id="chunk-2" />\n\nNext paragraph.')
  assert.match(html, /<p>First claim\. <span class="citation citation-kb"[^]*?<\/span><\/p>/)
  assert.match(html, /<p>Next paragraph\.<\/p>/)
})

test('attribute values survive Markdown emphasis characters', () => {
  const html = render('Claim <kb doc="__init__ *notes*" chunk_id="a_b_c" />')
  assert.match(html, /data-chunk-id="a_b_c"/)
  assert.match(html, /data-doc="__init__ \*notes\*"/)
})

test('tags without a chunk are dropped and plain Markdown is untouched', () => {
  assert.equal(render('Text <kb doc="Book" />'), '<p>Text </p>\n')
  assert.equal(render('Just **text**'), '<p>Just <strong>text</strong></p>\n')
})

const chunk = {
  id: 'chunk-1', knowledge_id: 'doc-1', knowledge_base_id: 'kb-1', chunk_index: 4, chunk_type: 'text',
  content: 'The cited passage.', source_locators: [{ type: 'pdf', page: 12 }],
}

test('a cited chunk becomes a references-panel entry named by the citation', () => {
  assert.deepEqual(citationReference(chunk, 'Sample Book'), {
    id: 'chunk-1', knowledge_id: 'doc-1', knowledge_base_id: 'kb-1', knowledge_title: 'Sample Book',
    chunk_index: 4, chunk_type: 'text', content: 'The cited passage.', source_locators: [{ type: 'pdf', page: 12 }],
  })
  assert.equal(citationReference({ id: 'chunk-1' }, 'Book'), null, 'a chunk without its document cannot be opened')
  assert.equal(citationReference(undefined, 'Book'), null)
})

test('the loader fetches each chunk once and retries only transient failures', async () => {
  const calls: string[] = []
  const outcomes: Record<string, () => Promise<{ data?: typeof chunk }>> = {
    'chunk-1': async () => ({ data: chunk }),
    gone: async () => { throw { $httpStatus: 404 } },
    flaky: async () => { throw { status: 503 } },
  }
  const load = createCitationReferenceLoader((id) => { calls.push(id); return outcomes[id]!() })

  const [first, second] = await Promise.all([load('chunk-1', 'Book'), load('chunk-1', 'Book')])
  assert.equal(first?.knowledge_id, 'doc-1')
  assert.equal(first, second)
  assert.equal(await load('gone', 'Book'), null)
  assert.equal(await load('gone', 'Book'), null)
  assert.equal(await load('flaky', 'Book'), null)
  outcomes.flaky = async () => ({ data: { ...chunk, id: 'flaky' } })
  assert.equal((await load('flaky', 'Book'))?.id, 'flaky')
  assert.deepEqual(calls, ['chunk-1', 'gone', 'flaky', 'flaky'])
})
