import { Connection } from './Connection'
import type { AuthOptions } from './types'

/**
 * Lazily dials one `Connection` per distinct relay URL and reuses it for every
 * item in an execution. Auth options are fixed for the pool's lifetime, which
 * matches n8n: one credential per node execution.
 */
export class RelayPool {
	private connections = new Map<string, Connection>()

	constructor(private readonly auth: AuthOptions = { authenticate: false }) {}

	/**
	 * `auth` is applied on first dial. Passing it again for an existing
	 * connection upgrades it, so an operation that carries a signer can
	 * authenticate a socket first opened by one that did not.
	 */
	connection(url: string, auth?: AuthOptions): Connection {
		let conn = this.connections.get(url)
		if (!conn) {
			conn = new Connection(url, auth ?? this.auth)
			this.connections.set(url, conn)
		} else if (auth) {
			conn.setAuth(auth)
		}
		return conn
	}

	async close(): Promise<void> {
		const conns = [...this.connections.values()]
		this.connections.clear()
		await Promise.all(conns.map((c) => c.close()))
	}
}
