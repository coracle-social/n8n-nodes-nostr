"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelayPool = void 0;
const Connection_1 = require("./Connection");
class RelayPool {
    auth;
    connections = new Map();
    constructor(auth = { authenticate: false }) {
        this.auth = auth;
    }
    connection(url, auth) {
        let conn = this.connections.get(url);
        if (!conn) {
            conn = new Connection_1.Connection(url, auth ?? this.auth);
            this.connections.set(url, conn);
        }
        else if (auth) {
            conn.setAuth(auth);
        }
        return conn;
    }
    async close() {
        const conns = [...this.connections.values()];
        this.connections.clear();
        await Promise.all(conns.map((c) => c.close()));
    }
}
exports.RelayPool = RelayPool;
//# sourceMappingURL=RelayPool.js.map