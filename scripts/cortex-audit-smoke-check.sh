#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AUDIT_DIR="$ROOT_DIR/dashboard/uploads/cortex-audit"

if [[ ! -d "$AUDIT_DIR" ]]; then
  echo "No audit directory found at: $AUDIT_DIR"
  exit 1
fi

TARGET_FILE="${1:-}"
if [[ -z "$TARGET_FILE" ]]; then
  TARGET_FILE="$(ls -t "$AUDIT_DIR"/*.json 2>/dev/null | head -n 1 || true)"
fi

if [[ -z "$TARGET_FILE" || ! -f "$TARGET_FILE" ]]; then
  echo "No audit JSON file found."
  exit 1
fi

node - "$TARGET_FILE" <<'NODE'
const fs = require('fs')
const file = process.argv[2]
const raw = fs.readFileSync(file, 'utf8')
const json = JSON.parse(raw)

const warnings = json?.assessments?.warnings || []
const actionResults = Array.isArray(json?.actionResults) ? json.actionResults : []
const failures = actionResults.filter((r) => !r?.success)
const screenQuality = actionResults
  .filter((r) => r?.success && (r?.type === 'create_screen' || r?.type === 'update_screen'))
  .map((r) => ({ type: r.type, qualityGate: r?.data?.qualityGate || null }))

console.log('=== Cortex Audit Smoke Check ===')
console.log('file:', file)
console.log('runId:', json?.runId || 'unknown')
console.log('')

console.log('Warnings:', warnings.length)
for (const w of warnings) console.log('-', w)
console.log('')

console.log('Action failures:', failures.length)
for (const f of failures) {
  console.log('-', `[${f.type}]`, f.error || 'Unknown error')
}
console.log('')

const hadEmojiReject = failures.some((f) => /emoji-heavy UI text/i.test(String(f.error || '')))
const hadEmojiRepair = screenQuality.some((q) => q.qualityGate && Number(q.qualityGate.emojiRemovedGlyphs || 0) > 0)

console.log('Emoji gate rejected:', hadEmojiReject ? 'YES' : 'NO')
console.log('Emoji text repaired:', hadEmojiRepair ? 'YES' : 'NO')

if (screenQuality.length > 0) {
  console.log('')
  console.log('Screen qualityGate stats:')
  for (const q of screenQuality) {
    if (!q.qualityGate) {
      console.log('-', q.type, 'no qualityGate metadata')
      continue
    }
    console.log('-', q.type,
      `touched=${q.qualityGate.emojiTouchedFields || 0},`,
      `removed=${q.qualityGate.emojiRemovedGlyphs || 0},`,
      `fallbacks=${q.qualityGate.emojiFallbackFields || 0}`)
  }
}
NODE
