// Turns dist/index.html into the artifact page format: no doctype/html/head/body wrappers.
import { readFileSync, writeFileSync } from 'node:fs'
const html = readFileSync('dist/index.html', 'utf8')
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1]
const title = head.match(/<title>[\s\S]*?<\/title>/)[0]
const links = (head.match(/<link[^>]*>/g) || []).filter((l) => !/rel="icon"/.test(l)).join('\n')
const styles = (head.match(/<style[\s\S]*?<\/style>/g) || []).join('\n')
const scripts = (head.match(/<script[\s\S]*?<\/script>/g) || []).join('\n')
writeFileSync('dist/artifact.html', [title, links, styles, body.trim(), scripts].join('\n'))
console.log('artifact.html', (readFileSync('dist/artifact.html').length / 1024).toFixed(0) + ' KB')
