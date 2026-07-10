/**
 * ESLint config for n8n-nodes-nostr.
 *
 * - The n8n community-node ruleset (eslint-plugin-n8n-nodes-base) is applied to
 *   the node and credential source under src/nodes and src/credentials.
 * - Everything else is checked by @typescript-eslint's recommended rules.
 * - Vendored crypto (src/vendor) is not our code and is not linted; see
 *   .eslintignore.
 *
 * No type-aware linting (no parserOptions.project): tsconfig.json excludes the
 * test tree, so a project-based parse would fail on test/*.ts. Type checking is
 * handled separately by `tsc --noEmit` in the lint script.
 *
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
	root: true,
	env: {
		es2022: true,
		node: true,
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		sourceType: 'module',
		ecmaVersion: 2022,
	},
	plugins: ['@typescript-eslint'],
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
	ignorePatterns: ['.eslintrc.js', '.prettierrc.js', 'dist/**', 'node_modules/**', 'src/vendor/**'],
	rules: {
		'@typescript-eslint/no-explicit-any': 'off',
		// The protocol code in src/nostr is adapted from nostr-tools and keeps its
		// deliberate bare `// @ts-ignore` suppressions on dynamically-typed index
		// writes, where `@ts-expect-error` would itself error on non-failing lines.
		'@typescript-eslint/ban-ts-comment': 'off',
		'@typescript-eslint/no-unused-vars': [
			'error',
			{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
		],
	},
	overrides: [
		{
			// The `community` config only carries package.json rules; the rules that
			// actually check node and credential source live in these two configs.
			// package.json itself is enforced by test/compliance.test.ts, which does
			// not need eslint to parse JSON.
			files: ['src/credentials/**/*.ts'],
			plugins: ['n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/credentials'],
			rules: {
				// This rule wants a camelCased docs slug, and says so itself: "Only
				// applicable to nodes in the main repository." For a community package
				// `cred-class-field-documentation-url-not-http-url` applies instead, and
				// the two contradict. The official n8n starter disables this one too.
				'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
			},
		},
		{
			files: ['src/nodes/**/*.ts'],
			plugins: ['n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/nodes'],
		},
	],
}
