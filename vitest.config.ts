import { defineConfig } from 'vitest/config'

// Tests import { describe, it, expect } from 'vitest' explicitly, so globals are
// off. Everything runs in the node environment against real crypto and the mock
// relay (test/helpers/mockRelay.ts).
export default defineConfig({
	test: {
		environment: 'node',
		globals: false,
		include: ['test/**/*.test.ts'],
		setupFiles: ['test/vitest.setup.ts'],
	},
})
