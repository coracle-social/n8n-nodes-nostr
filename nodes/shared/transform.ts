import type { IDataObject, INodeExecutionData } from 'n8n-workflow'

import type { Event } from '../../nostr'

export interface EventToJsonOptions {
	/** Wrap the event as `{ event, relay }` instead of spreading it. */
	envelope?: boolean
	relay?: string
}

export interface EventToItemOptions extends EventToJsonOptions {
	itemIndex?: number
}

/** The output shape of a single event, shared by the trigger and the query action. */
export function eventToJson(event: Event, opts: EventToJsonOptions = {}): IDataObject {
	const json: IDataObject = opts.envelope
		? ({ event: event as unknown as IDataObject, relay: opts.relay } as IDataObject)
		: ({ ...(event as unknown as IDataObject), relay: opts.relay } as IDataObject)

	if (!opts.relay) delete json.relay

	return json
}

/** Pairs an output item back to the input item that produced it. */
export function toItem(json: IDataObject, itemIndex: number): INodeExecutionData {
	return { json, pairedItem: { item: itemIndex } }
}

export function eventToItem(event: Event, opts: EventToItemOptions = {}): INodeExecutionData {
	const item: INodeExecutionData = { json: eventToJson(event, opts) }
	if (opts.itemIndex !== undefined) item.pairedItem = { item: opts.itemIndex }
	return item
}
