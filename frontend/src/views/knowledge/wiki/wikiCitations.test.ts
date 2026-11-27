import assert from 'node:assert/strict'
import test from 'node:test'

import { marked } from 'marked'

import { renderWithCitations } from './wikiCitations.ts'

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
