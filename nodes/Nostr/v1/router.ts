import * as encryption from './actions/encryption'
import * as event from './actions/event'
import * as utility from './actions/utility'
import type { OperationFn, ResourceModule } from './types'

export const resources: Record<string, ResourceModule> = {
	event: event.module,
	encryption: encryption.module,
	utility: utility.module,
}

/** Returns the handler, or undefined when the pairing does not exist. */
export function route(resource: string, operation: string): OperationFn | undefined {
	return resources[resource]?.operations[operation]
}
