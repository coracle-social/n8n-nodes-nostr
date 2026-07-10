"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthState = exports.ConnState = void 0;
var ConnState;
(function (ConnState) {
    ConnState["Disconnected"] = "disconnected";
    ConnState["Connecting"] = "connecting";
    ConnState["Open"] = "open";
    ConnState["Closing"] = "closing";
})(ConnState || (exports.ConnState = ConnState = {}));
var AuthState;
(function (AuthState) {
    AuthState["None"] = "none";
    AuthState["Challenged"] = "challenged";
    AuthState["Pending"] = "pending";
    AuthState["Ok"] = "ok";
    AuthState["Failed"] = "failed";
})(AuthState || (exports.AuthState = AuthState = {}));
//# sourceMappingURL=types.js.map