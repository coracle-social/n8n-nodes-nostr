import { describe, expect, it } from 'vitest'

import {
	isAuthRequired,
	normalizeRelayUrl,
	parseRelayMessage,
	serializeCloseFrame,
	serializeReqFrame,
} from '../../src/relay/messages'

describe('parseRelayMessage', () => {
	it('parses EVENT', () => {
		const event = { id: 'a', kind: 1 }
		expect(parseRelayMessage(JSON.stringify(['EVENT', 'sub1', event]))).toEqual({
			type: 'EVENT',
			subId: 'sub1',
			event,
		})
	})

	it('parses OK with and without a reason', () => {
		expect(parseRelayMessage('["OK","abc",true,""]')).toEqual({ type: 'OK', id: 'abc', ok: true, reason: '' })
		expect(parseRelayMessage('["OK","abc",false,"blocked"]')).toEqual({
			type: 'OK',
			id: 'abc',
			ok: false,
			reason: 'blocked',
		})
		expect(parseRelayMessage('["OK","abc",true]')).toEqual({ type: 'OK', id: 'abc', ok: true, reason: '' })
	})

	it('parses EOSE, CLOSED, NOTICE and AUTH', () => {
		expect(parseRelayMessage('["EOSE","s"]')).toEqual({ type: 'EOSE', subId: 's' })
		expect(parseRelayMessage('["CLOSED","s","auth-required: x"]')).toEqual({
			type: 'CLOSED',
			subId: 's',
			reason: 'auth-required: x',
		})
		expect(parseRelayMessage('["NOTICE","hi"]')).toEqual({ type: 'NOTICE', message: 'hi' })
		expect(parseRelayMessage('["AUTH","chal"]')).toEqual({ type: 'AUTH', challenge: 'chal' })
	})

	it.each([
		['not json', 'relay sent malformed JSON'],
		['{"a":1}', 'relay sent a frame that is not a tagged array'],
		['[]', 'relay sent a frame that is not a tagged array'],
		['["EVENT","s"]', 'malformed EVENT frame'],
		['["OK",1,true]', 'malformed OK frame'],
		['["EOSE"]', 'malformed EOSE frame'],
		['["AUTH"]', 'malformed AUTH frame'],
		['["WAT","x"]', 'unknown relay frame type "WAT"'],
	])('rejects %s', (raw, message) => {
		expect(() => parseRelayMessage(raw)).toThrow(message)
	})
})

describe('serializers', () => {
	it('builds a REQ with multiple filters', () => {
		expect(serializeReqFrame('s', [{ kinds: [1] }, { kinds: [7] }])).toBe(
			'["REQ","s",{"kinds":[1]},{"kinds":[7]}]',
		)
	})

	it('builds a CLOSE', () => {
		expect(serializeCloseFrame('s')).toBe('["CLOSE","s"]')
	})
})

describe('normalizeRelayUrl', () => {
	it.each([
		['wss://Relay.Example.COM', 'wss://relay.example.com'],
		['wss://relay.example.com/', 'wss://relay.example.com'],
		['wss://relay.example.com/path/', 'wss://relay.example.com/path/'],
		['ws://127.0.0.1:7777', 'ws://127.0.0.1:7777'],
	])('%s -> %s', (input, expected) => {
		expect(normalizeRelayUrl(input)).toBe(expected)
	})

	it('passes through something unparseable rather than throwing', () => {
		expect(normalizeRelayUrl('not a url')).toBe('not a url')
	})
})

describe('isAuthRequired', () => {
	it.each(['auth-required: need auth', 'restricted: not allowed', 'AUTH-REQUIRED: x'])(
		'recognises %s',
		(reason) => expect(isAuthRequired(reason)).toBe(true),
	)

	it.each(['blocked: banned', 'invalid: bad sig', 'rate-limited', ''])('ignores %s', (reason) =>
		expect(isAuthRequired(reason)).toBe(false),
	)
})
