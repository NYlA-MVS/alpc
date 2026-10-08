// Turns dist/index.html into the artifact page format: no doctype/html/head/body wrappers.
// The inlined app may contain "</head>" or "<body>" inside strings (the Word export does),
// so take the real document boundaries: the last </head>, and the <body> after it.
import { readFileSync, writeFileSync } from 'node:fs'
const html = readFileSync('dist/index.html', 'utf8')
const headEnd = html.lastIndexOf('</head>')
const head = html.slice(html.indexOf('<head>') + 6, headEnd)
const bodyStart = html.indexOf('<body>', headEnd) + 6
const body = html.slice(bodyStart, html.lastIndexOf('</body>'))
const title = head.match(/<title>[\s\S]*?<\/title>/)[0]
const links = (head.match(/<link[^>]*>/g) || []).filter((l) => !/rel="icon"/.test(l)).join('\n')
const styles = (head.match(/<style[\s\S]*?<\/style>/g) || []).join('\n')
const scripts = (head.match(/<script[\s\S]*?<\/script>/g) || []).join('\n')
writeFileSync('dist/artifact.html', [title, links, styles, body.trim(), scripts].join('\n'))
console.log('artifact.html', (readFileSync('dist/artifact.html').length / 1024).toFixed(0) + ' KB')
