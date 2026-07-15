// Parser markdown aman untuk chat (subset):
//   **bold**  *italic*  `code`  ~~strike~~  + autolink URL
// Mengembalikan array node: { type: 'text'|'bold'|'italic'|'code'|'strike'|'link', text, href? }
// TIDAK mengembalikan HTML string -> aman dari XSS (Vue render lewat {{ }} / <a>).
// Escaping HTML otomatis karena kita tidak pernah menyuntikkan raw HTML ke DOM.

const URL_RE = /(https?:\/\/[^\s<]+)/gi

function tokenizeInline(text) {
  // urutan: code (prioritas, ga diparse dalamnya), lalu bold, italic, strike, link
  const nodes = []
  let i = 0
  while (i < text.length) {
    // code `...`
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1)
      if (end > i + 1) {
        nodes.push({ type: 'code', text: text.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }
    // bold **...**
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2)
      if (end > i + 1) {
        nodes.push({ type: 'bold', text: text.slice(i + 2, end), children: tokenizeInline(text.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    }
    // italic *...*
    if (text[i] === '*') {
      const end = text.indexOf('*', i + 1)
      if (end > i + 1) {
        nodes.push({ type: 'italic', text: text.slice(i + 1, end), children: tokenizeInline(text.slice(i + 1, end)) })
        i = end + 1
        continue
      }
    }
    // strike ~~...~~
    if (text[i] === '~' && text[i + 1] === '~') {
      const end = text.indexOf('~~', i + 2)
      if (end > i + 1) {
        nodes.push({ type: 'strike', text: text.slice(i + 2, end) })
        i = end + 2
        continue
      }
    }
    // plain sampai delimiter berikutnya atau URL
    let j = i + 1
    let nextDelim = text.length
    for (const d of ['`', '*', '~']) {
      const idx = text.indexOf(d, j)
      if (idx !== -1 && idx < nextDelim) nextDelim = idx
    }
    let seg = text.slice(i, nextDelim)
    // split URL di dalam segmen plain
    let last = 0
    URL_RE.lastIndex = 0
    let m
    while ((m = URL_RE.exec(seg))) {
      if (m.index > last) nodes.push({ type: 'text', text: seg.slice(last, m.index) })
      nodes.push({ type: 'link', text: m[0], href: m[0] })
      last = m.index + m[0].length
    }
    if (last < seg.length) nodes.push({ type: 'text', text: seg.slice(last) })
    i = nextDelim
  }
  return nodes
}

export function parseMarkdown(src) {
  if (!src) return []
  return tokenizeInline(src)
}
