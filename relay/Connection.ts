import { makeAuthEvent } from '../nostr'
import type { Event, Filter } from '../nostr'
import {
	isAuthRequired,
	normalizeRelayUrl,
	parseRelayMessage,
	serializeAuthFrame,
	serializeCloseFrame,
	serializeEventFrame,
	serializeReqFrame,
} from './messages'
import { delay, onTimeout, withTimeout } from './timers'
import type { Cancel } from './timers'
import { AuthState, ConnState } from './types'
import type { AuthOptions, PerRelayResult, ReqHandle, ReqHandlers } from './types'

/**
 * `WebSocket` has been a Node global since v22, and n8n requires >= 22.22.
 * It is referenced bare rather than through `globalThis`, which n8n's
 * community-node ruleset forbids. See relay/timers.ts.
 */
type Socket = WebSocket

const CONNECT_TIMEOUT_MS = 10_000
/** How long to wait for a relay to volunteer a challenge after it says auth-required. */
const CHALLENGE_WAIT_MS = 1_500
const AUTH_TIMEOUT_MS = 10_000

const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000]

interface AuthResult {
	ok: boolean
	reason: string
}

interface SubRecord {
	filters: Filter[]
	handlers: ReqHandlers
	/** At most one AUTH-triggered resend, ever. Otherwise a hostile relay loops us. */
	authRetried: boolean
}

interface PublishRecord {
	event: Event
	authRetried: boolean
	settle(ok: boolean, reason: string): void
}

/**
 * One websocket to one relay, plus the NIP-42 handshake.
 *
 * Relay-level outcomes (rejected event, closed subscription, refused auth) are
 * reported as data. The only rejections that escape are transport failures on
 * `connect()`.
 */
export class Connection {
	readonly url: string
	state: ConnState = ConnState.Disconnected
	authState: AuthState = AuthState.None

	private auth: AuthOptions
	private ws?: Socket
	private sendQueue: string[] = []
	private subs = new Map<string, SubRecord>()
	private publishes = new Map<string, PublishRecord>()

	private challenge?: string
	private challengeWaiters: Array<(challenge: string | undefined) => void> = []
	private authPromise?: Promise<AuthResult>
	private authEventId?: string
	private authSettle?: (result: AuthResult) => void
	private authFailReason = ''

	/** Only long-lived subscriptions reconnect; one-shot publish/query do not. */
	autoReconnect = false
	private disposed = false
	private backoffAttempt = 0
	private cancelReconnect?: Cancel
	private connectPromise?: Promise<void>
	private closeWaiters: Array<() => void> = []

	constructor(url: string, auth: AuthOptions) {
		this.url = url
		this.auth = auth
	}

	private canAuth(): boolean {
		return Boolean(this.auth.authenticate && this.auth.signer)
	}

	/** Upgrades a socket opened without a signer so it can answer a challenge. */
	setAuth(auth: AuthOptions): void {
		if (auth.signer === this.auth.signer && auth.authenticate === this.auth.authenticate) return
		this.auth = auth
		// A previous "cannot authenticate" verdict was about the old credential.
		if (this.authState === AuthState.Failed || this.authState === AuthState.Challenged) {
			this.authState = this.challenge ? AuthState.Challenged : AuthState.None
			this.authPromise = undefined
			this.authFailReason = ''
		}
	}

	// ---------------------------------------------------------------- transport

	connect(timeoutMs = CONNECT_TIMEOUT_MS): Promise<void> {
		if (this.disposed) return Promise.reject(new Error('connection disposed'))
		if (this.state === ConnState.Open) return Promise.resolve()
		if (this.connectPromise) return this.connectPromise

		this.state = ConnState.Connecting
		this.connectPromise = new Promise<void>((resolve, reject) => {
			let settled = false
			const cancelTimer = onTimeout(timeoutMs, () => {
				if (settled) return
				settled = true
				this.connectPromise = undefined
				try {
					this.ws?.close()
				} catch {
					/* already gone */
				}
				reject(new Error(`timed out connecting to ${this.url}`))
			})

			let ws: Socket
			try {
				ws = new WebSocket(this.url)
			} catch (err) {
				cancelTimer()
				settled = true
				this.connectPromise = undefined
				this.state = ConnState.Disconnected
				reject(err instanceof Error ? err : new Error(String(err)))
				return
			}
			this.ws = ws

			ws.addEventListener('open', () => {
				this.state = ConnState.Open
				this.backoffAttempt = 0
				this.flushSendQueue()
				if (settled) return
				settled = true
				cancelTimer()
				resolve()
			})

			ws.addEventListener('message', (ev: MessageEvent) => {
				this.handleMessage(typeof ev.data === 'string' ? ev.data : String(ev.data))
			})

			ws.addEventListener('error', () => {
				// A websocket error is always followed by close; let close do the work.
				// Swallowing it here keeps Node from treating it as unhandled.
			})

			ws.addEventListener('close', () => {
				const wasConnecting = !settled
				this.handleClose()
				if (wasConnecting) {
					settled = true
					cancelTimer()
					reject(new Error(`could not connect to ${this.url}`))
				}
			})
		})

		// A failed connect must not poison the next attempt.
		this.connectPromise.catch(() => undefined).then(() => {
			if (this.state !== ConnState.Open) this.connectPromise = undefined
		})
		return this.connectPromise
	}

	private handleClose(): void {
		const wasOpen = this.state === ConnState.Open
		this.state = ConnState.Disconnected
		this.connectPromise = undefined
		this.ws = undefined
		this.sendQueue = []

		// Auth is bound to the socket, not the relay.
		this.authState = AuthState.None
		this.challenge = undefined
		this.authPromise = undefined
		this.authEventId = undefined
		this.authSettle?.({ ok: false, reason: 'connection closed' })
		this.authSettle = undefined
		this.releaseChallengeWaiters(undefined)

		for (const rec of this.publishes.values()) rec.settle(false, 'connection closed before OK')
		this.publishes.clear()

		if (this.disposed || !this.autoReconnect || this.subs.size === 0) {
			if (this.disposed) {
				this.closeWaiters.splice(0).forEach((w) => w())
			} else if (!wasOpen && this.subs.size > 0) {
				// Connect failed outright with live subs and no reconnect: report and drop.
				for (const [subId, sub] of this.subs) {
					this.subs.delete(subId)
					sub.handlers.onClosed?.('connection closed')
				}
			}
			return
		}

		const backoff = BACKOFF_MS[Math.min(this.backoffAttempt, BACKOFF_MS.length - 1)]
		this.backoffAttempt++
		const jittered = backoff * (0.8 + Math.random() * 0.4)
		this.cancelReconnect = onTimeout(jittered, () => {
			if (this.disposed) return
			this.connect()
				.then(() => this.resubscribeAll())
				.catch(() => undefined) // handleClose will schedule the next attempt
		})
	}

	private resubscribeAll(): void {
		for (const [subId, sub] of this.subs) {
			sub.authRetried = false
			this.send(serializeReqFrame(subId, sub.filters))
		}
	}

	private send(frame: string): void {
		if (this.state === ConnState.Open && this.ws) this.ws.send(frame)
		else this.sendQueue.push(frame)
	}

	private flushSendQueue(): void {
		const queued = this.sendQueue.splice(0)
		for (const frame of queued) this.ws?.send(frame)
	}

	// ------------------------------------------------------------------- NIP-42

	private releaseChallengeWaiters(challenge: string | undefined): void {
		this.challengeWaiters.splice(0).forEach((w) => w(challenge))
	}

	private waitForChallenge(timeoutMs: number): Promise<string | undefined> {
		if (this.challenge) return Promise.resolve(this.challenge)
		return new Promise((resolve) => {
			const cancelTimer = onTimeout(timeoutMs, () => {
				this.challengeWaiters = this.challengeWaiters.filter((w) => w !== waiter)
				resolve(undefined)
			})
			const waiter = (challenge: string | undefined) => {
				cancelTimer()
				resolve(challenge)
			}
			this.challengeWaiters.push(waiter)
		})
	}

	/**
	 * Resolves once this socket is authenticated, or once we know it cannot be.
	 * Concurrent callers share one handshake.
	 */
	private ensureAuth(): Promise<AuthResult> {
		if (this.authState === AuthState.Ok) return Promise.resolve({ ok: true, reason: '' })
		if (this.authState === AuthState.Failed) {
			return Promise.resolve({ ok: false, reason: this.authFailReason })
		}
		if (!this.canAuth()) return Promise.resolve({ ok: false, reason: 'auth-required: no credential' })
		if (!this.authPromise) this.authPromise = this.performAuth()
		return this.authPromise
	}

	private async performAuth(): Promise<AuthResult> {
		const challenge = this.challenge ?? (await this.waitForChallenge(CHALLENGE_WAIT_MS))
		if (!challenge) {
			this.authState = AuthState.Failed
			this.authFailReason = 'auth-required: relay never sent a challenge'
			return { ok: false, reason: this.authFailReason }
		}

		const signer = this.auth.signer
		if (!signer) return { ok: false, reason: 'auth-required: no credential' }

		let authEvent: Event
		try {
			authEvent = signer.signEvent(makeAuthEvent(normalizeRelayUrl(this.url), challenge))
		} catch (err) {
			this.authState = AuthState.Failed
			this.authFailReason = `could not sign auth event: ${(err as Error).message}`
			return { ok: false, reason: this.authFailReason }
		}

		this.authState = AuthState.Pending
		this.authEventId = authEvent.id

		const settled = new Promise<AuthResult>((resolve) => {
			this.authSettle = resolve
		})

		this.send(serializeAuthFrame(authEvent))

		const result = await withTimeout(settled, AUTH_TIMEOUT_MS, () => ({
			ok: false,
			reason: 'timed out waiting for auth OK',
		}))
		this.authSettle = undefined
		if (result.ok) {
			this.authState = AuthState.Ok
		} else {
			this.authState = AuthState.Failed
			this.authFailReason = result.reason || 'auth rejected'
		}
		return result
	}

	// ---------------------------------------------------------------- dispatch

	private handleMessage(raw: string): void {
		let msg
		try {
			msg = parseRelayMessage(raw)
		} catch {
			return // A relay speaking gibberish is not our problem to escalate.
		}

		switch (msg.type) {
			case 'AUTH': {
				this.challenge = msg.challenge
				this.releaseChallengeWaiters(msg.challenge)
				if (this.authState === AuthState.None) {
					// Eager: some relays challenge on connect and never say auth-required.
					if (this.canAuth()) void this.ensureAuth()
					else this.authState = AuthState.Challenged
				}
				return
			}

			case 'EVENT': {
				this.subs.get(msg.subId)?.handlers.onEvent(msg.event)
				return
			}

			case 'EOSE': {
				this.subs.get(msg.subId)?.handlers.onEose?.()
				return
			}

			case 'OK': {
				if (this.authEventId && msg.id === this.authEventId) {
					this.authSettle?.({ ok: msg.ok, reason: msg.reason })
					return
				}
				const rec = this.publishes.get(msg.id)
				if (!rec) return

				if (!msg.ok && isAuthRequired(msg.reason)) {
					if (!this.canAuth()) {
						rec.settle(false, 'auth-required: no credential')
						return
					}
					if (!rec.authRetried) {
						rec.authRetried = true
						void this.ensureAuth().then((auth) => {
							if (!this.publishes.has(msg.id)) return
							if (auth.ok) this.send(serializeEventFrame(rec.event))
							else rec.settle(false, auth.reason || msg.reason)
						})
						return
					}
				}
				rec.settle(msg.ok, msg.reason)
				return
			}

			case 'CLOSED': {
				const sub = this.subs.get(msg.subId)
				if (!sub) return

				if (isAuthRequired(msg.reason)) {
					if (!this.canAuth()) {
						this.subs.delete(msg.subId)
						sub.handlers.onClosed?.('auth-required: no credential')
						return
					}
					if (!sub.authRetried) {
						sub.authRetried = true
						void this.ensureAuth().then((auth) => {
							if (!this.subs.has(msg.subId)) return
							if (auth.ok) {
								this.send(serializeReqFrame(msg.subId, sub.filters))
							} else {
								this.subs.delete(msg.subId)
								sub.handlers.onClosed?.(auth.reason || msg.reason)
							}
						})
						return
					}
				}
				this.subs.delete(msg.subId)
				sub.handlers.onClosed?.(msg.reason)
				return
			}

			case 'NOTICE':
				return
		}
	}

	// ------------------------------------------------------------- operations

	async publish(event: Event, timeoutMs: number): Promise<PerRelayResult> {
		const started = Date.now()
		const result = (ok: boolean, reason: string): PerRelayResult => ({
			relay: this.url,
			ok,
			reason,
			durationMs: Date.now() - started,
		})

		try {
			await this.connect(timeoutMs)
		} catch (err) {
			return result(false, (err as Error).message)
		}

		return new Promise<PerRelayResult>((resolve) => {
			const cancelTimer = onTimeout(timeoutMs, () => {
				this.publishes.delete(event.id)
				resolve(result(false, 'timed out waiting for OK'))
			})

			this.publishes.set(event.id, {
				event,
				authRetried: false,
				settle: (ok, reason) => {
					cancelTimer()
					this.publishes.delete(event.id)
					resolve(result(ok, reason))
				},
			})

			this.send(serializeEventFrame(event))
		})
	}

	req(subId: string, filters: Filter[], handlers: ReqHandlers): ReqHandle {
		this.subs.set(subId, { filters, handlers, authRetried: false })

		this.connect()
			.then(() => {
				if (this.subs.has(subId)) this.send(serializeReqFrame(subId, filters))
			})
			.catch((err: Error) => {
				if (!this.subs.delete(subId)) return
				handlers.onClosed?.(err.message)
			})

		return {
			close: () => {
				if (!this.subs.delete(subId)) return
				if (this.state === ConnState.Open) this.send(serializeCloseFrame(subId))
			},
		}
	}

	updateFilters(subId: string, filters: Filter[]): void {
		const sub = this.subs.get(subId)
		if (sub) sub.filters = filters
	}

	async close(): Promise<void> {
		if (this.disposed) return
		this.disposed = true
		this.autoReconnect = false
		this.cancelReconnect?.()

		for (const subId of [...this.subs.keys()]) {
			if (this.state === ConnState.Open) this.send(serializeCloseFrame(subId))
			this.subs.delete(subId)
		}

		if (!this.ws || this.state === ConnState.Disconnected) {
			this.state = ConnState.Disconnected
			return
		}

		const closed = new Promise<void>((resolve) => this.closeWaiters.push(resolve))
		this.state = ConnState.Closing
		try {
			this.ws.close()
		} catch {
			return
		}
		// Never let a relay that refuses to close a socket hang a workflow.
		await Promise.race([closed, delay(2_000)])
	}
}
