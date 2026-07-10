import { describe, expect, it } from 'vitest'

import { eventToItem, eventToJson, toItem } from '../../nodes/shared/transform'
import { makeEvent } from '../helpers/events'

const RELAY = 'wss://relay.example'

describe('eventToJson', () => {
	it('spreads the event and attaches the relay', () => {
		const event = makeEvent({ content: 'hi' })
		const json = eventToJson(event, { relay: RELAY })

		expect(json.id).toBe(event.id)
		expect(json.content).toBe('hi')
		expect(json.relay).toBe(RELAY)
	})

	it('wraps the event when an envelope is asked for', () => {
		const event = makeEvent()

		expect(eventToJson(event, { envelope: true, relay: RELAY })).toEqual({ event, relay: RELAY })
	})

	it('omits the relay key entirely when there is no relay', () => {
		const event = makeEvent()

		expect('relay' in eventToJson(event, {})).toBe(false)
		expect('relay' in eventToJson(event, { envelope: true })).toBe(false)
	})
})

describe('toItem', () => {
	it('pairs the output back to the input item', () => {
		expect(toItem({ ok: true }, 3)).toEqual({ json: { ok: true }, pairedItem: { item: 3 } })
	})
})

describe('eventToItem', () => {
	it('pairs the item only when an index is given', () => {
		const event = makeEvent()

		expect(eventToItem(event, { itemIndex: 2 }).pairedItem).toEqual({ item: 2 })
		expect(eventToItem(event).pairedItem).toBeUndefined()
	})
})
