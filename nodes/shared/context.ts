import type { IExecuteFunctions, ITriggerFunctions } from 'n8n-workflow'

export type NodeFns = IExecuteFunctions | ITriggerFunctions

/**
 * `IExecuteFunctions.getNodeParameter` takes an item index and
 * `ITriggerFunctions.getNodeParameter` does not. The shared helpers are used by
 * both nodes, so they read parameters through this instead of branching.
 */
export type ParamReader = <T>(name: string, fallback?: T) => T

export function paramReader(fns: NodeFns, itemIndex?: number): ParamReader {
	if (itemIndex === undefined) {
		return <T>(name: string, fallback?: T): T =>
			(fns as ITriggerFunctions).getNodeParameter(name, fallback as never) as T
	}
	return <T>(name: string, fallback?: T): T =>
		(fns as IExecuteFunctions).getNodeParameter(name, itemIndex, fallback as never) as T
}

/** Credentials are optional on every node here; absence must not throw. */
export async function optionalCredentials(
	fns: NodeFns,
	name = 'nostrPrivateKeyApi',
): Promise<Record<string, unknown> | undefined> {
	try {
		const creds = await fns.getCredentials(name)
		return creds as unknown as Record<string, unknown>
	} catch {
		return undefined
	}
}
