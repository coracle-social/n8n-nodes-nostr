/**
 * Matches the house style already committed in test/vendor-crypto.test.ts:
 * tabs, single quotes, and no semicolons where they can be dropped.
 *
 * @type {import('prettier').Config}
 */
module.exports = {
	useTabs: true,
	tabWidth: 2,
	semi: false,
	singleQuote: true,
	trailingComma: 'all',
	bracketSpacing: true,
	arrowParens: 'always',
	printWidth: 100,
	endOfLine: 'lf',
}
