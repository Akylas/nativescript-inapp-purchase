import { EventData, Observable, Utils } from '@nativescript/core';
import { Failure } from './failure';
import { Item } from './item';
import { Order } from './order';

export abstract class InAppPurchaseBase extends Observable {
    abstract init(): void;
    abstract tearDown(): void;
    abstract fetchSubscriptions(itemIds: string[]): void;

    abstract fetchItems(itemIds: string[]): void;

    abstract startSubscription(item: Item, options?: BuyItemOptions): void;

    abstract buyItem(item: Item, buyItemOptions: BuyItemOptions): void;

    abstract finalizeOrder(order: Order): void;

    abstract restoreOrders(): void;

    abstract canMakePayments(): boolean;
}

// export function toMainThread() {
//     return <T>(source: Observable<T>) =>
//         new Observable<T>((observer) =>
//             source.subscribe({
//                 next: (x) => Utils.executeOnMainThread(() => observer.next(x)),
//                 error: (err) => Utils.executeOnMainThread(() => observer.error(err)),
//                 complete: () => Utils.executeOnMainThread(() => observer.complete())
//             })
//         );
// }

export namespace PaymentEvent {
    export const EventName = 'PaymentEvent';
    export enum Context {
        CONNECTING_STORE = 'CONNECTING_STORE',
        RETRIEVING_ITEMS = 'RETRIEVING_ITEMS',
        PROCESSING_ORDER = 'PROCESSING_ORDER',
        FINALIZING_ORDER = 'FINALIZING_ORDER',
        RESTORING_ORDERS = 'RESTORING_ORDERS'
    }

    export enum Result {
        STARTED = 'STARTED',
        PENDING = 'PENDING',
        SUCCESS = 'SUCCESS',
        FAILURE = 'FAILURE'
    }

    type IPayload = Failure | Item | Order | Item[] | string[] | number | null;

    export interface IEvent extends EventData {
        context: Context;
        result: Result;
        payload: IPayload;
    }

    /**
     * Connecting Store Events
     */
    export namespace ConnectingStore {
        interface IConnectingStoreEvent extends IEvent {
            context: Context.CONNECTING_STORE;
            payload: null | Failure;
        }

        export interface IStarted extends IConnectingStoreEvent {
            result: Result.STARTED;
            payload: null;
        }

        export interface IPending extends IConnectingStoreEvent {
            result: Result.PENDING;
            payload: null;
        }

        export interface ISuccess extends IConnectingStoreEvent {
            result: Result.SUCCESS;
            payload: null;
        }

        export interface IFailure extends IConnectingStoreEvent {
            result: Result.FAILURE;
            payload: Failure;
        }
    }

    export type ConnectingStore = ConnectingStore.IStarted | ConnectingStore.IPending | ConnectingStore.ISuccess | ConnectingStore.IFailure;

    /**
     * Retrieving Items Events
     */
    export namespace RetrievingItems {
        interface IRetrievingItemsEvent extends IEvent {
            context: Context.RETRIEVING_ITEMS;
            payload: string[] | Item[] | Failure;
        }

        export interface IStarted extends IRetrievingItemsEvent {
            result: Result.STARTED;
            payload: string[];
        }

        export interface IPending extends IRetrievingItemsEvent {
            result: Result.PENDING;
            payload: string[];
        }

        export interface ISuccess extends IRetrievingItemsEvent {
            result: Result.SUCCESS;
            payload: Item[];
        }

        export interface IFailure extends IRetrievingItemsEvent {
            result: Result.FAILURE;
            payload: Failure;
        }
    }

    export type RetrievingItems = RetrievingItems.IStarted | RetrievingItems.IPending | RetrievingItems.ISuccess | RetrievingItems.IFailure;

    /**
     * Processing Order Events
     */
    export namespace ProcessingOrder {
        interface IProcessingOrderEvent extends IEvent {
            context: Context.PROCESSING_ORDER;
            payload: Item | number | Order | Failure;
        }

        export interface IStarted extends IProcessingOrderEvent {
            result: Result.STARTED;
            payload: Item;
        }

        export interface IPending extends IProcessingOrderEvent {
            result: Result.PENDING;
            payload: number;
        }

        export interface ISuccess extends IProcessingOrderEvent {
            result: Result.SUCCESS;
            payload: Order;
        }

        export interface IFailure extends IProcessingOrderEvent {
            result: Result.FAILURE;
            payload: Failure;
        }
    }

    export type ProcessingOrder = ProcessingOrder.IStarted | ProcessingOrder.IPending | ProcessingOrder.ISuccess | ProcessingOrder.IFailure;

    /**
     * Finalizing Order Events
     */
    export namespace FinalizingOrder {
        interface IFinalizingOrderEvent extends IEvent {
            context: Context.FINALIZING_ORDER;
            payload: Order | Failure;
        }

        export interface IStarted extends IFinalizingOrderEvent {
            result: Result.STARTED;
            payload: Order;
        }

        export interface IPending extends IFinalizingOrderEvent {
            result: Result.PENDING;
            payload: Order;
        }

        export interface ISuccess extends IFinalizingOrderEvent {
            result: Result.SUCCESS;
            payload: Order;
        }

        export interface IFailure extends IFinalizingOrderEvent {
            result: Result.FAILURE;
            payload: Failure;
        }
    }

    export type FinalizingOrder = FinalizingOrder.IStarted | FinalizingOrder.IPending | FinalizingOrder.ISuccess | FinalizingOrder.IFailure;

    /**
     * Restoring Orders Events
     */
    export namespace RestoringOrders {
        interface IRestoringOrdersEvent extends IEvent {
            context: Context.RESTORING_ORDERS;
            payload: null | Order | Failure;
        }

        export interface IStarted extends IRestoringOrdersEvent {
            result: Result.STARTED;
            payload: null;
        }

        export interface IPending extends IRestoringOrdersEvent {
            result: Result.PENDING;
            payload: Order;
        }

        export interface ISuccess extends IRestoringOrdersEvent {
            result: Result.SUCCESS;
            payload: null;
        }

        export interface IFailure extends IRestoringOrdersEvent {
            result: Result.FAILURE;
            payload: Failure;
        }
    }

    export type RestoringOrders = RestoringOrders.IStarted | RestoringOrders.IPending | RestoringOrders.ISuccess | RestoringOrders.IFailure;

    export type Type = ConnectingStore | RetrievingItems | ProcessingOrder | FinalizingOrder | RestoringOrders;
}

export interface BuyItemOptions {
    /**
     * A string that associates the payment transaction with a user on your own service.
     */
    accountUserName?: string;
    android?: {
        /**
         *  Specifies an optional obfuscated string that is uniquely associated with the user's account in your app.
         */
        obfuscatedAccountId?: string;

        /**
         *  Specifies an optional obfuscated string that is uniquely associated with the user's profile in your app.
         */
        obfuscatedProfileId?: string;
    };
    ios?: {
        /**
         * A string that identifies a product that can be purchased from within your app.
         */
        productIdentifier?: string;

        /**
         * A Boolean value that produces an “ask to buy” flow for this payment in the sandbox.
         */
        simulatesAskToBuyInSandbox?: boolean;

        /**
         * The number of items the user wants to purchase.
         */
        quantity?: number;
    };
}
