import type { IDataObject, INodeExecutionData } from 'n8n-workflow'

import type { Event } from '../../nostr'

export interface EventToItemOptions {
	/** Wrap the event as `{ event, relay }` instead of spreading it. */
	envelope?: boolean
	relay?: string
	itemIndex?: number
}

export function eventToItem(event: Event, opts: EventToItemOptions = {}): INodeExecutionData {
	const json: IDataObject = opts.envelope
		? ({ event: event as unknown as IDataObject, relay: opts.relay } as IDataObject)
		: ({ ...(event as unknown as IDataObject), relay: opts.relay } as IDataObject)

	if (!opts.relay) delete json.relay

	const item: INodeExecutionData = { json }
	if (opts.itemIndex !== undefined) item.pairedItem = { item: opts.itemIndex }
	return item
}
