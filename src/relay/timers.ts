/**
 * Deadlines without the `setTimeout` global.
 *
 * n8n's verified-community-node ruleset (`@n8n/eslint-plugin-community-nodes`,
 * rule `no-restricted-globals`) forbids `setTimeout`, `clearTimeout`,
 * `setInterval` and friends, and its `no-restricted-imports` rule does not allow
 * `node:timers`. `AbortSignal` is neither restricted nor an import, so every
 * timeout in the relay layer is built on `AbortSignal.timeout`.
 *
 * One consequence worth knowing: the timer behind `AbortSignal.timeout` is
 * unref'd, so it will not by itself keep the Node event loop alive. Every
 * deadline here runs alongside an open websocket, which does hold the loop open.
 * The one exception is reconnect backoff, which relies on the host process (n8n)
 * being alive for its own reasons — which it always is.
 */

export type Cancel = () => void

/**
 * Calls `fn` after `ms`, unless the returned cancel runs first.
 *
 * `AbortSignal.timeout` rejects a non-integer delay with ERR_OUT_OF_RANGE, where
 * `setTimeout` would happily truncate it. Jittered backoff produces fractions,
 * so round here rather than at every call site.
 */
export function onTimeout(ms: number, fn: () => void): Cancel {
	const signal = AbortSignal.timeout(Math.max(0, Math.round(ms)))
	let cancelled = false

	const handler = (): void => {
		if (!cancelled) fn()
	}

	signal.addEventListener('abort', handler, { once: true })

	return () => {
		cancelled = true
		signal.removeEventListener('abort', handler)
	}
}

/** Resolves after `ms`. */
export function delay(ms: number): Promise<void> {
	return new Promise<void>((resolve) => {
		onTimeout(ms, resolve)
	})
}

/** Resolves with `fallback()` if `promise` has not settled within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: () => T): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const cancel = onTimeout(ms, () => resolve(fallback()))
		promise.then(
			(value) => {
				cancel()
				resolve(value)
			},
			(err) => {
				cancel()
				reject(err)
			},
		)
	})
}
