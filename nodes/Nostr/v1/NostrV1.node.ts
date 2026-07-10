import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow'
import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
} from 'n8n-workflow'

import { RelayPool } from '../../../relay'
import { nostrKeyTest, resolveSigner } from '../../shared'
import { resources, route } from './router'

export class NostrV1 implements INodeType {
	description: INodeTypeDescription

	constructor(baseDescription: INodeTypeBaseDescription) {
		this.description = {
			...baseDescription,
			version: 1,
			defaults: { name: 'Nostr' },
			inputs: [NodeConnectionTypes.Main],
			outputs: [NodeConnectionTypes.Main],
			usableAsTool: true,
			credentials: [
				{
					name: 'nostrPrivateKeyApi',
					// Publishing, signing and encryption need a key; querying and NIP-19 do not.
					required: false,
					testedBy: 'nostrKeyTest',
					displayOptions: { hide: { resource: ['utility'] } },
				},
			],
			properties: [
				{
					displayName: 'Resource',
					name: 'resource',
					type: 'options',
					noDataExpression: true,
					default: 'event',
					options: [
						{ name: 'Event', value: 'event' },
						{ name: 'Encryption', value: 'encryption' },
						{ name: 'Utility', value: 'utility' },
					],
				},
				...resources.event.description,
				...resources.encryption.description,
				...resources.utility.description,
			],
		}
	}

	methods = {
		credentialTest: { nostrKeyTest },
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData()
		const resource = this.getNodeParameter('resource', 0) as string
		const operation = this.getNodeParameter('operation', 0) as string

		const run = route(resource, operation)
		if (!run) {
			throw new NodeOperationError(this.getNode(), `The operation "${operation}" is not supported for "${resource}".`)
		}

		// One pool for the whole execution: relay connections are reused across
		// items, and every socket is closed before we return.
		const signer = await resolveSigner(this)
		const pool = new RelayPool({ authenticate: true, signer })
		const returnData: INodeExecutionData[] = []

		try {
			for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
				try {
					returnData.push(...(await run({ ctx: this, itemIndex, pool })))
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({
							json: { error: (error as Error).message },
							pairedItem: { item: itemIndex },
						})
						continue
					}
					if (error instanceof NodeOperationError) throw error
					throw new NodeOperationError(this.getNode(), error as Error, { itemIndex })
				}
			}
		} finally {
			await pool.close()
		}

		return [returnData]
	}
}
