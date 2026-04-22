#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const projectRoot = process.cwd()
const cssDir = path.join(projectRoot, 'node_modules', 'next-auth', 'css')
const jsFile = path.join(cssDir, 'index.js')
const cssFile = path.join(cssDir, 'index.css')

function fileExists(filePath) {
  try {
    fs.accessSync(filePath)
    return true
  } catch {
    return false
  }
}

function isValidModule(modulePath) {
  try {
    delete require.cache[require.resolve(modulePath)]
    const fn = require(modulePath)
    return typeof fn === 'function' && typeof fn() === 'string'
  } catch {
    return false
  }
}

function repair() {
  if (!fileExists(cssFile)) {
    console.warn('[repair-next-auth-css] Skipped: next-auth css source not found.')
    return
  }

  const css = fs.readFileSync(cssFile, 'utf8')
  const js = 'module.exports = function() { return ' + JSON.stringify(css) + ' }\n'
  fs.writeFileSync(jsFile, js, 'utf8')
  console.log('[repair-next-auth-css] Rebuilt node_modules/next-auth/css/index.js')
}

if (!fileExists(jsFile)) {
  repair()
  process.exit(0)
}

if (!isValidModule(jsFile)) {
  repair()
  process.exit(0)
}

console.log('[repair-next-auth-css] OK')
