/**
 * The smallest IExecuteFunctions / ITriggerFunctions that the Nostr nodes touch.
 *
 * Deliberately hand-rolled: importing n8n's own test doubles would pull the whole
 * core in, and these nodes only use a handful of methods.
 */
import type {
	IExecuteFunctions,
	INode,
	INodeExecutionData,
	ITriggerFunctions,
	IDataObject,
} from 'n8n-workflow'

export type Params = Record<string, unknown>

export interface MockOptions {
	params: Params
	credentials?: Record<string, unknown>
	items?: INodeExecutionData[]
	continueOnFail?: boolean
	mode?: string
	staticData?: Record<string, unknown>
}

const NODE: INode = {
	id: 'test-node',
	name: 'Nostr',
	typeVersion: 1,
	type: 'n8n-nodes-base.nostr',
	position: [0, 0],
	parameters: {},
}

/**
 * n8n resolves `options.timeoutMs` style lookups itself; our nodes always read
 * whole collections, so a flat map with a fallback is faithful enough.
 */
const readParam = (params: Params, name: string, fallback: unknown): unknown => {
	if (name in params) return params[name]
	return fallback
}

export interface MockExecute {
	fns: IExecuteFunctions
	returned: INodeExecutionData[][]
}

export function mockExecuteFunctions(opts: MockOptions): IExecuteFunctions {
	const items = opts.items ?? [{ json: {} }]
	const staticData = opts.staticData ?? {}

	const fns = {
		getInputData: () => items,
		getNode: () => NODE,
		getMode: () => opts.mode ?? 'manual',
		continueOnFail: () => opts.continueOnFail ?? false,
		getWorkflowStaticData: () => staticData,
		getNodeParameter: (name: string, _itemIndex?: number, fallback?: unknown) =>
			readParam(opts.params, name, fallback),
		getCredentials: async (name: string) => {
			if (!opts.credentials) throw new Error(`no credentials of type ${name}`)
			return opts.credentials
		},
		helpers: {
			returnJsonArray: (data: IDataObject | IDataObject[]): INodeExecutionData[] =>
				(Array.isArray(data) ? data : [data]).map((json) => ({ json })),
		},
		logger: {
			debug: () => undefined,
			info: () => undefined,
			warn: () => undefined,
			error: () => undefined,
		},
	}

	return fns as unknown as IExecuteFunctions
}

export interface EmitCall {
	data: INodeExecutionData[][]
	deduplicationKey?: string
}

export interface MockTrigger {
	fns: ITriggerFunctions
	emits: EmitCall[]
	staticData: Record<string, unknown>
}

export function mockTriggerFunctions(opts: MockOptions): MockTrigger {
	const emits: EmitCall[] = []
	const staticData = opts.staticData ?? {}

	const fns = {
		getNode: () => ({ ...NODE, type: 'n8n-nodes-base.nostrTrigger' }),
		getMode: () => opts.mode ?? 'trigger',
		getActivationMode: () => 'activate',
		getWorkflowStaticData: () => staticData,
		// ITriggerFunctions.getNodeParameter has no item index.
		getNodeParameter: (name: string, fallback?: unknown) => readParam(opts.params, name, fallback),
		getCredentials: async (name: string) => {
			if (!opts.credentials) throw new Error(`no credentials of type ${name}`)
			return opts.credentials
		},
		emit: (
			data: INodeExecutionData[][],
			_responsePromise?: unknown,
			_donePromise?: unknown,
			deduplicationKey?: string,
		) => {
			emits.push({ data, deduplicationKey })
		},
		helpers: {
			returnJsonArray: (data: IDataObject | IDataObject[]): INodeExecutionData[] =>
				(Array.isArray(data) ? data : [data]).map((json) => ({ json })),
		},
		logger: {
			debug: () => undefined,
			info: () => undefined,
			warn: () => undefined,
			error: () => undefined,
		},
	}

	return { fns: fns as unknown as ITriggerFunctions, emits, staticData }
}
