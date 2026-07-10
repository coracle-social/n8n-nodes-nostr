// Build step: tsc emits only *.js/*.d.ts, so the node icons (*.svg) and node
// codex files (*.node.json) never reach dist/. This mirrors them from the source
// dirs into dist/ preserving structure, e.g.
//   nodes/Nostr/nostr.svg        -> dist/nodes/Nostr/nostr.svg
//   nodes/Nostr/Nostr.node.json  -> dist/nodes/Nostr/Nostr.node.json
// Build script only: node:fs + node:path are fine here (the runtime rule that
// forbids fs applies to the node/credential source, not to tooling).
import { readdirSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'

// Source dirs that carry assets; their paths are already dist-relative (no src/
// prefix to strip), so a copied file's path doubles as its dist destination.
const SRC_DIRS = ['credentials', 'nodes']
const DIST = 'dist'

function walk(dir) {
	const files = []
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name)
		if (entry.isDirectory()) files.push(...walk(full))
		else files.push(full)
	}
	return files
}

const isAsset = (file) => file.endsWith('.svg') || file.endsWith('.node.json')

const assets = SRC_DIRS.flatMap((dir) => walk(dir)).filter(isAsset)

for (const file of assets) {
	const dest = join(DIST, file)
	mkdirSync(dirname(dest), { recursive: true })
	copyFileSync(file, dest)
	console.log(`copy-icons: ${file}`)
}

console.log(`copy-icons: copied ${assets.length} asset(s) into ${DIST}/`)
