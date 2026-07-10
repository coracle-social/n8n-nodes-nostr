import type { IDataObject, INodeExecutionData } from 'n8n-workflow';
import type { Event } from '../../nostr';
export interface EventToJsonOptions {
    envelope?: boolean;
    relay?: string;
}
export interface EventToItemOptions extends EventToJsonOptions {
    itemIndex?: number;
}
export declare function eventToJson(event: Event, opts?: EventToJsonOptions): IDataObject;
export declare function toItem(json: IDataObject, itemIndex: number): INodeExecutionData;
export declare function eventToItem(event: Event, opts?: EventToItemOptions): INodeExecutionData;
