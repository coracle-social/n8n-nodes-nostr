"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tagFiltersField = exports.createdAtOption = exports.authenticateOption = exports.filterModeField = exports.relaysField = void 0;
exports.timeoutMsOption = timeoutMsOption;
exports.relaysField = {
    displayName: 'Relays',
    name: 'relays',
    type: 'string',
    typeOptions: { rows: 3 },
    default: '',
    placeholder: 'e.g. wss://relay.damus.io',
    description: 'One relay URL per line. Leave empty to use the default relays from your credential.',
};
exports.filterModeField = {
    displayName: 'Filter Mode',
    name: 'filterMode',
    type: 'options',
    noDataExpression: true,
    default: 'fields',
    options: [
        { name: 'Fields', value: 'fields', description: 'Build the filter from individual fields' },
        {
            name: 'Raw Filter JSON',
            value: 'rawFilter',
            description: 'Supply a raw NIP-01 filter object',
        },
    ],
    description: 'How to build the Nostr filter',
};
exports.authenticateOption = {
    displayName: 'Authenticate',
    name: 'authenticate',
    type: 'boolean',
    default: true,
    description: 'Whether to answer a relay NIP-42 authentication challenge',
};
exports.createdAtOption = {
    displayName: 'Created At',
    name: 'createdAt',
    type: 'dateTime',
    default: '',
    description: 'Event timestamp. Defaults to now.',
};
function timeoutMsOption(defaultMs, description) {
    return {
        displayName: 'Timeout (Ms)',
        name: 'timeoutMs',
        type: 'number',
        default: defaultMs,
        description,
    };
}
exports.tagFiltersField = {
    displayName: 'Tag Filters',
    name: 'tagFilters',
    type: 'fixedCollection',
    typeOptions: { multipleValues: true },
    default: {},
    placeholder: 'Add tag filter',
    description: 'Filter on indexed tags, such as #e, #p or #t',
    options: [
        {
            name: 'tag',
            displayName: 'Tag',
            values: [
                {
                    displayName: 'Tag',
                    name: 'tag',
                    type: 'string',
                    default: 't',
                    placeholder: 'e.g. t',
                    description: 'A single-letter tag name, such as e, p or t',
                },
                {
                    displayName: 'Values',
                    name: 'values',
                    type: 'string',
                    default: '',
                    placeholder: 'e.g. nostr, bitcoin',
                    description: 'Comma-separated values to match for this tag',
                },
            ],
        },
    ],
};
//# sourceMappingURL=descriptions.js.map