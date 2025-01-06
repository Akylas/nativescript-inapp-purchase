import { Observable } from '@nativescript/core';
import { BuyItemOptions, InAppPurchaseBase, PaymentEvent } from './index-common';
import { Failure } from './failure';
import { Item } from './item';
import { Order, OrderState } from './order';

export * from './index-common';
export * from './failure';
export * from './item';
export * from './order';

let _productRequest: SKProductsRequest | null;
let _productRequestDelegate: SKProductRequestDelegateImpl | null;
let _paymentTransactionObserver: SKPaymentTransactionObserverImpl | null;

export class InAppPurchase extends InAppPurchaseBase {
    init() {
        if (!_paymentTransactionObserver) {
            this.notify({
                eventName: PaymentEvent.EventName,
                context: PaymentEvent.Context.CONNECTING_STORE,
                result: PaymentEvent.Result.STARTED,
                payload: null
            });
            _paymentTransactionObserver = SKPaymentTransactionObserverImpl.initWithOwner(this);
            this.notify({
                eventName: PaymentEvent.EventName,
                context: PaymentEvent.Context.CONNECTING_STORE,
                result: PaymentEvent.Result.PENDING,
                payload: null
            });
            try {
                SKPaymentQueue.defaultQueue().addTransactionObserver(_paymentTransactionObserver);
                this.notify({
                    eventName: PaymentEvent.EventName,
                    context: PaymentEvent.Context.CONNECTING_STORE,
                    result: PaymentEvent.Result.SUCCESS,
                    payload: null
                });
            } catch (e) {
                const errorPayload = typeof e === 'object' ? e.message : e;
                console.error(new Error(`Init failed: ${errorPayload}`));
                this.notify({
                    eventName: PaymentEvent.EventName,
                    context: PaymentEvent.Context.CONNECTING_STORE,
                    result: PaymentEvent.Result.FAILURE,
                    payload: new Failure(null)
                });
            }
        }
    }

    tearDown(): void {
        if (_paymentTransactionObserver) {
            SKPaymentQueue.defaultQueue().removeTransactionObserver(_paymentTransactionObserver);
        }
        _paymentTransactionObserver = null;
    }

    fetchSubscriptions(itemIds: string[]): void {
        this.fetchItems(itemIds);
    }

    fetchItems(itemIds: string[]): void {
        this.notify({
            eventName: PaymentEvent.EventName,
            context: PaymentEvent.Context.RETRIEVING_ITEMS,
            result: PaymentEvent.Result.STARTED,
            payload: itemIds
        });
        const productIds: NSMutableSet<string> = NSMutableSet.alloc<string>().init();
        itemIds.forEach((value: string) => productIds.addObject(value));
        _productRequest = SKProductsRequest.alloc().initWithProductIdentifiers(productIds);
        _productRequestDelegate = SKProductRequestDelegateImpl.initWithOwner(this);
        _productRequest.delegate = _productRequestDelegate;
        _productRequest.start();
        this.notify({
            eventName: PaymentEvent.EventName,
            context: PaymentEvent.Context.RETRIEVING_ITEMS,
            result: PaymentEvent.Result.PENDING,
            payload: itemIds
        });
    }

    startSubscription(item: Item, options?: BuyItemOptions): void {
        this.buyItem(item, options);
    }

    buyItem(item: Item, buyItemOptions: BuyItemOptions): void {
        if (SKPaymentQueue.defaultQueue().transactions) {
            const pendingCount = SKPaymentQueue.defaultQueue().transactions.count;
            if (!pendingCount) {
                this.notify({
                    eventName: PaymentEvent.EventName,
                    context: PaymentEvent.Context.PROCESSING_ORDER,
                    result: PaymentEvent.Result.PENDING,
                    payload: pendingCount + 1
                });
                const payment = SKMutablePayment.paymentWithProduct(item.nativeValue as SKProduct);
                if (buyItemOptions) {
                    payment.applicationUsername = buyItemOptions?.accountUserName || '';
                    payment.simulatesAskToBuyInSandbox = buyItemOptions.ios?.simulatesAskToBuyInSandbox || false;
                    payment.quantity = buyItemOptions.ios?.quantity || 1;
                }
                try {
                    SKPaymentQueue.defaultQueue().addPayment(payment);
                    this.notify({
                        eventName: PaymentEvent.EventName,
                        context: PaymentEvent.Context.PROCESSING_ORDER,
                        result: PaymentEvent.Result.STARTED,
                        payload: item
                    });
                } catch (e) {
                    const errorPayload = typeof e === 'object' ? e.message : e;
                    console.error(new Error(`Error while adding payment: ${errorPayload}`));
                    this.notify({
                        eventName: PaymentEvent.EventName,
                        context: PaymentEvent.Context.PROCESSING_ORDER,
                        result: PaymentEvent.Result.FAILURE,
                        payload: new Failure(null)
                    });
                }
            } else {
                this.notify({
                    eventName: PaymentEvent.EventName,
                    context: PaymentEvent.Context.PROCESSING_ORDER,
                    result: PaymentEvent.Result.PENDING,
                    payload: pendingCount
                });
            }
        } else {
            console.error(new Error('SKPaymentQueue.defaultQueue().transactions missing.'));
        }
    }

    finalizeOrder(order: Order): void {
        this.notify({
            eventName: PaymentEvent.EventName,
            context: PaymentEvent.Context.FINALIZING_ORDER,
            result: PaymentEvent.Result.STARTED,
            payload: order
        });
        if (order.state === OrderState.VALID && !order.restored) {
            try {
                SKPaymentQueue.defaultQueue().finishTransaction(order.nativeValue as SKPaymentTransaction);
                this.notify({
                    eventName: PaymentEvent.EventName,
                    context: PaymentEvent.Context.FINALIZING_ORDER,
                    result: PaymentEvent.Result.PENDING,
                    payload: order
                });
            } catch (e) {
                const errorPayload = typeof e === 'object' ? e.message : e;
                console.error(new Error(`Error while finalizing order: ${errorPayload}`));
                this.notify({
                    eventName: PaymentEvent.EventName,
                    context: PaymentEvent.Context.FINALIZING_ORDER,
                    result: PaymentEvent.Result.FAILURE,
                    payload: new Failure(null)
                });
            }
        } else {
            this.notify({
                eventName: PaymentEvent.EventName,
                context: PaymentEvent.Context.FINALIZING_ORDER,
                result: PaymentEvent.Result.FAILURE,
                payload: new Failure(999)
            });
        }
    }

    restoreOrders(): void {
        this.notify({
            eventName: PaymentEvent.EventName,
            context: PaymentEvent.Context.RESTORING_ORDERS,
            result: PaymentEvent.Result.STARTED,
            payload: null
        });
        try {
            SKPaymentQueue.defaultQueue().restoreCompletedTransactions();
        } catch (e) {
            const errorPayload = typeof e === 'object' ? e.message : e;
            console.error(new Error(`Error while restoring order: ${errorPayload}`));
            this.notify({
                eventName: PaymentEvent.EventName,
                context: PaymentEvent.Context.RESTORING_ORDERS,
                result: PaymentEvent.Result.FAILURE,
                payload: new Failure(null)
            });
        }
    }

    canMakePayments(): boolean {
        // TODO ?
        return SKPaymentQueue.canMakePayments();
    }

    _transactionHandler(queue: SKPaymentQueue, transactions: NSArray<SKPaymentTransaction>): void {
        this.notify({
            eventName: PaymentEvent.EventName,
            context: PaymentEvent.Context.PROCESSING_ORDER,
            result: PaymentEvent.Result.PENDING,
            payload: queue.transactions ? queue.transactions.count : 0
        });
        const count = transactions?.count ?? 0;
        if (count) {
            for (let i = 0; i < count; i++) {
                const transaction: SKPaymentTransaction = transactions.objectAtIndex(i);

                switch (transaction.transactionState) {
                    case SKPaymentTransactionState.Purchased:
                        this.notify({
                            eventName: PaymentEvent.EventName,
                            context: PaymentEvent.Context.PROCESSING_ORDER,
                            result: PaymentEvent.Result.SUCCESS,
                            payload: new Order(transaction)
                        });
                        break;
                    case SKPaymentTransactionState.Failed:
                        this.notify({
                            eventName: PaymentEvent.EventName,
                            context: PaymentEvent.Context.PROCESSING_ORDER,
                            result: PaymentEvent.Result.FAILURE,
                            payload: new Failure(transaction.error.code)
                        });
                        try {
                            queue.finishTransaction(transaction);
                        } catch (e) {
                            const errorPayload = typeof e === 'object' ? e.message : e;
                            console.error(new Error(`Error while finalizing failed order: ${errorPayload}`));
                        }
                        break;
                    case SKPaymentTransactionState.Restored:
                        this.notify({
                            eventName: PaymentEvent.EventName,
                            context: PaymentEvent.Context.PROCESSING_ORDER,
                            result: PaymentEvent.Result.SUCCESS,
                            payload: new Order(transaction.originalTransaction, true)
                        });
                        this.notify({
                            eventName: PaymentEvent.EventName,
                            context: PaymentEvent.Context.RESTORING_ORDERS,
                            result: PaymentEvent.Result.PENDING,
                            payload: new Order(transaction.originalTransaction, true)
                        });
                        try {
                            queue.finishTransaction(transaction);
                        } catch (e) {
                            const errorPayload = typeof e === 'object' ? e.message : e;
                            console.error(new Error(`Error while finalizing restored order: ${errorPayload}`));
                        }
                        break;
                    case SKPaymentTransactionState.Purchasing:
                    case SKPaymentTransactionState.Deferred: // TODO ?
                        break;
                    default:
                        console.error(new Error('Missing or unknown transaction state.'));
                        break;
                }
            }
        }
        this.notify({
            eventName: PaymentEvent.EventName,
            context: PaymentEvent.Context.PROCESSING_ORDER,
            result: PaymentEvent.Result.PENDING,
            payload: queue.transactions ? queue.transactions.count : 0
        });
    }
}

@NativeClass
class SKProductRequestDelegateImpl extends NSObject implements SKProductsRequestDelegate {
    public static ObjCProtocols = [SKProductsRequestDelegate];

    _owner: WeakRef<InAppPurchase>;
    static initWithOwner(owner) {
        const observer = new SKProductRequestDelegateImpl();
        observer._owner = new WeakRef(owner);
        return observer;
    }

    public productsRequestDidReceiveResponse(request: SKProductsRequest, response: SKProductsResponse) {
        const products: NSArray<SKProduct> = response.products;

        // log the invalid IDs if any
        if (response.invalidProductIdentifiers.count >= 1) {
            console.log('Invalid product identifiers: ' + JSON.stringify(response.invalidProductIdentifiers.componentsJoinedByString(', ')));
        }

        const result: Item[] = [];
        const count = products.count;
        for (let i = 0; i < count; i++) {
            result.push(new Item(products.objectAtIndex(i)));
        }

        const owner = this._owner?.get();
        owner?.notify({
            eventName: PaymentEvent.EventName,
            context: PaymentEvent.Context.RETRIEVING_ITEMS,
            result: PaymentEvent.Result.SUCCESS,
            payload: result
        });

        this._cleanup();
    }

    public requestDidFailWithError(request: SKRequest, error: NSError) {
        const owner = this._owner?.get();
        owner?.notify({
            eventName: PaymentEvent.EventName,
            context: PaymentEvent.Context.RETRIEVING_ITEMS,
            result: PaymentEvent.Result.FAILURE,
            payload: new Failure(error.code)
        });
        this._cleanup();
    }

    private _cleanup() {
        _productRequestDelegate = null;
        _productRequest = null;
    }
}

@NativeClass
class SKPaymentTransactionObserverImpl extends NSObject implements SKPaymentTransactionObserver {
    public static ObjCProtocols = [SKPaymentTransactionObserver];

    _owner: WeakRef<InAppPurchase>;
    static initWithOwner(owner) {
        const observer = new SKPaymentTransactionObserverImpl();
        observer._owner = new WeakRef(owner);
        return observer;
    }

    public paymentQueueUpdatedTransactions(queue: SKPaymentQueue, transactions: NSArray<SKPaymentTransaction>): void {
        const owner = this._owner?.get();
        owner?._transactionHandler(queue, transactions);
    }

    public paymentQueueRestoreCompletedTransactionsFinished(queue: SKPaymentQueue): void {
        const owner = this._owner?.get();
        owner?.notify({
            eventName: PaymentEvent.EventName,
            context: PaymentEvent.Context.RESTORING_ORDERS,
            result: PaymentEvent.Result.SUCCESS,
            payload: null
        });
    }

    public paymentQueueRestoreCompletedTransactionsFailedWithError(queue: SKPaymentQueue, error: NSError): void {
        const owner = this._owner?.get();
        owner?.notify({
            eventName: PaymentEvent.EventName,
            context: PaymentEvent.Context.RESTORING_ORDERS,
            result: PaymentEvent.Result.FAILURE,
            payload: new Failure(error.code)
        });
    }

    public paymentQueueRemovedTransactions(queue: SKPaymentQueue, transactions: NSArray<SKPaymentTransaction>): void {
        const owner = this._owner?.get();

        if (transactions && transactions.count) {
            for (let i = 0; i < transactions.count; i++) {
                const transaction: SKPaymentTransaction = transactions.objectAtIndex(i);
                if (transaction.transactionState === SKPaymentTransactionState.Purchased) {
                    owner?.notify({
                        eventName: PaymentEvent.EventName,
                        context: PaymentEvent.Context.FINALIZING_ORDER,
                        result: PaymentEvent.Result.SUCCESS,
                        payload: new Order(transaction)
                    });
                }
            }
        }
        owner?.notify({
            eventName: PaymentEvent.EventName,
            context: PaymentEvent.Context.PROCESSING_ORDER,
            result: PaymentEvent.Result.PENDING,
            payload: queue.transactions ? queue.transactions.count : 0
        });
    }

    public paymentQueueShouldAddStorePaymentForProduct(queue: SKPaymentQueue, payment: SKPayment, product: SKProduct): boolean {
        return true;
    }

    public paymentQueueUpdatedDownloads(queue: SKPaymentQueue, downloads: NSArray<SKDownload>): void {
        console.log('paymentQueueUpdatedDownloads called. Not implemented.');
    }
}
