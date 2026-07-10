"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paramReader = paramReader;
exports.optionalCredentials = optionalCredentials;
function paramReader(fns, itemIndex) {
    if (itemIndex === undefined) {
        return (name, fallback) => fns.getNodeParameter(name, fallback);
    }
    return (name, fallback) => fns.getNodeParameter(name, itemIndex, fallback);
}
async function optionalCredentials(fns, name = 'nostrPrivateKeyApi') {
    try {
        const creds = await fns.getCredentials(name);
        return creds;
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=context.js.map