/**
 * An in-process NIP-01 relay, with enough NIP-42 to exercise the real handshake.
 *
 * `ws` is a devDependency and is only ever imported from here — our runtime source
 * uses the global WebSocket. Every test relay must be stopped in afterAll or vitest hangs.
 */
import { WebSocketServer, type WebSocket } from 'ws'
import type { AddressInfo } from 'node:net'

import { matchFilters } from '../../nostr/filter'
import { verifyEvent } from '../../nostr/pure'
import type { Event, Filter } from '../../nostr/core'

export type AuthMode =
	/** Never asks for auth. */
	| 'none'
	/** Sends ["AUTH", challenge] on connect, and requires it before REQ/EVENT. */
	| 'proactive'
	/** Silent until a REQ arrives, then ["CLOSED", sub, "auth-required: ..."]. */
	| 'on-req'
	/** Silent until an EVENT arrives, then ["OK", id, false, "auth-required: ..."]. */
	| 'on-event'
	/** Says auth-required on REQ but never sends a challenge. */
	| 'on-req-no-challenge'

export interface MockRelayOptions {
	authMode?: AuthMode
	/** Reject the client's signed AUTH event, to prove we do not retry forever. */
	rejectAuth?: boolean
	/** Serve events for a REQ but never send EOSE. */
	neverEose?: boolean
	/** Reject every published event with this reason. */
	rejectPublishReason?: string
	/** Accept the EVENT frame but never answer with an OK, to exercise timeouts. */
	silentOnEvent?: boolean
	events?: Event[]
}

export class MockRelay {
	private wss?: WebSocketServer
	private sockets = new Set<WebSocket>()
	private authed = new WeakSet<WebSocket>()
	private challenges = new WeakMap<WebSocket, string>()
	/** Open subscriptions, so `broadcast` can push live events like a real relay. */
	private subs = new Map<WebSocket, Map<string, Filter[]>>()

	url = ''
	events: Event[]

	/** Observability for tests: how many times the client (re)sent each frame. */
	reqCount = 0
	eventCount = 0
	authCount = 0

	constructor(private readonly opts: MockRelayOptions = {}) {
		this.events = opts.events ?? []
	}

	get clientCount(): number {
		return this.sockets.size
	}

	private get authMode(): AuthMode {
		return this.opts.authMode ?? 'none'
	}

	private needsAuth(ws: WebSocket): boolean {
		return this.authMode !== 'none' && !this.authed.has(ws)
	}

	async start(): Promise<string> {
		this.wss = new WebSocketServer({ host: '127.0.0.1', port: 0 })
		await new Promise<void>((resolve) => this.wss!.once('listening', resolve))
		const { port } = this.wss.address() as AddressInfo
		this.url = `ws://127.0.0.1:${port}`

		this.wss.on('connection', (ws) => {
			this.sockets.add(ws)
			this.subs.set(ws, new Map())
			ws.on('close', () => {
				this.sockets.delete(ws)
				this.subs.delete(ws)
			})
			ws.on('message', (data) => this.handle(ws, data.toString()))

			if (this.authMode === 'proactive') {
				const challenge = `challenge-${Math.random().toString(36).slice(2)}`
				this.challenges.set(ws, challenge)
				ws.send(JSON.stringify(['AUTH', challenge]))
			}
		})
		return this.url
	}

	/** Pushes an event to every open subscription whose filters match it. */
	broadcast(event: Event): void {
		this.events.push(event)
		for (const [ws, subs] of this.subs) {
			for (const [subId, filters] of subs) {
				if (matchFilters(filters, event)) this.send(ws, ['EVENT', subId, event])
			}
		}
	}

	/** Forcibly drops every connected client, leaving the server listening. */
	dropClients(): void {
		for (const ws of [...this.sockets]) ws.terminate()
		this.sockets.clear()
		this.subs.clear()
	}

	async stop(): Promise<void> {
		for (const ws of this.sockets) ws.terminate()
		this.sockets.clear()
		this.subs.clear()
		if (!this.wss) return
		await new Promise<void>((resolve) => this.wss!.close(() => resolve()))
		this.wss = undefined
	}

	private send(ws: WebSocket, frame: unknown[]): void {
		if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(frame))
	}

	private handle(ws: WebSocket, raw: string): void {
		let frame: any[]
		try {
			frame = JSON.parse(raw)
		} catch {
			return
		}

		switch (frame[0]) {
			case 'REQ':
				return this.handleReq(ws, frame)
			case 'EVENT':
				return this.handleEvent(ws, frame[1] as Event)
			case 'AUTH':
				return this.handleAuth(ws, frame[1] as Event)
			case 'CLOSE':
				this.subs.get(ws)?.delete(frame[1] as string)
				return
		}
	}

	private handleReq(ws: WebSocket, frame: any[]): void {
		this.reqCount++
		const subId = frame[1] as string
		const filters = frame.slice(2) as Filter[]

		if (this.needsAuth(ws)) {
			if (this.authMode === 'on-req' && !this.challenges.has(ws)) {
				const challenge = `challenge-${Math.random().toString(36).slice(2)}`
				this.challenges.set(ws, challenge)
				this.send(ws, ['AUTH', challenge])
			}
			// 'on-req-no-challenge' deliberately sends no AUTH frame at all.
			this.send(ws, ['CLOSED', subId, 'auth-required: we only serve authenticated users'])
			return
		}

		this.subs.get(ws)?.set(subId, filters)

		for (const event of this.events) {
			if (matchFilters(filters, event)) this.send(ws, ['EVENT', subId, event])
		}
		if (!this.opts.neverEose) this.send(ws, ['EOSE', subId])
	}

	private handleEvent(ws: WebSocket, event: Event): void {
		this.eventCount++

		if (this.opts.silentOnEvent) return

		if (this.needsAuth(ws)) {
			if (this.authMode === 'on-event' && !this.challenges.has(ws)) {
				const challenge = `challenge-${Math.random().toString(36).slice(2)}`
				this.challenges.set(ws, challenge)
				this.send(ws, ['AUTH', challenge])
			}
			this.send(ws, ['OK', event.id, false, 'auth-required: please authenticate'])
			return
		}

		if (this.opts.rejectPublishReason) {
			this.send(ws, ['OK', event.id, false, this.opts.rejectPublishReason])
			return
		}

		if (!verifyEvent(event)) {
			this.send(ws, ['OK', event.id, false, 'invalid: signature verification failed'])
			return
		}

		this.events.push(event)
		this.send(ws, ['OK', event.id, true, ''])
	}

	private handleAuth(ws: WebSocket, event: Event): void {
		this.authCount++
		const challenge = this.challenges.get(ws)
		const tag = (name: string) => event.tags.find((t) => t[0] === name)?.[1]

		if (this.opts.rejectAuth) {
			this.send(ws, ['OK', event.id, false, 'auth rejected: go away'])
			return
		}
		if (event.kind !== 22242) {
			this.send(ws, ['OK', event.id, false, 'invalid: wrong kind'])
			return
		}
		if (!challenge || tag('challenge') !== challenge) {
			this.send(ws, ['OK', event.id, false, 'invalid: challenge mismatch'])
			return
		}
		if (!tag('relay')) {
			this.send(ws, ['OK', event.id, false, 'invalid: missing relay tag'])
			return
		}
		if (!verifyEvent(event)) {
			this.send(ws, ['OK', event.id, false, 'invalid: bad signature'])
			return
		}

		this.authed.add(ws)
		this.send(ws, ['OK', event.id, true, ''])
	}
}

/** Starts a relay and returns it already listening. */
export async function startMockRelay(opts: MockRelayOptions = {}): Promise<MockRelay> {
	const relay = new MockRelay(opts)
	await relay.start()
	return relay
}
