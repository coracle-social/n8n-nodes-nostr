// Build step: tsc emits only *.js/*.d.ts, so the node icons (*.svg) and node
// codex files (*.node.json) never reach dist/. This mirrors them from src/ into
// dist/ preserving structure, e.g.
//   src/nodes/Nostr/nostr.svg        -> dist/nodes/Nostr/nostr.svg
//   src/nodes/Nostr/Nostr.node.json  -> dist/nodes/Nostr/Nostr.node.json
// Build script only: node:fs + node:path are fine here (the runtime rule that
// forbids fs applies to src/, not to tooling).
import { readdirSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'

const SRC = 'src'
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

const assets = walk(SRC).filter(isAsset)

for (const file of assets) {
	const rel = relative(SRC, file)
	const dest = join(DIST, rel)
	mkdirSync(dirname(dest), { recursive: true })
	copyFileSync(file, dest)
	console.log(`copy-icons: ${rel}`)
}

console.log(`copy-icons: copied ${assets.length} asset(s) into ${DIST}/`)
