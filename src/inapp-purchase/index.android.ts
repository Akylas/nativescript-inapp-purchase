﻿import { Application, Utils } from '@nativescript/core';
import { BuyItemOptions, InAppPurchaseBase, PaymentEvent } from './index-common';
import { Failure } from './failure';
import { Item } from './item';
import { Order, OrderState } from './order';

export * from './index-common';
export * from './failure';
export * from './item';
export * from './order';

let _billingClient: com.android.billingclient.api.BillingClient | null;
let _isBillingAvailable: boolean;
export class InAppPurchase extends InAppPurchaseBase {
    init() {
        if (!_billingClient) {
            this.notify({
                eventName: PaymentEvent.EventName,
                context: PaymentEvent.Context.CONNECTING_STORE,
                result: PaymentEvent.Result.STARTED,
                payload: null
            });
            const context = Utils.android.getApplicationContext();
            if (context) {
                _billingClient = com.android.billingclient.api.BillingClient.newBuilder(context)
                    .enablePendingPurchases()
                    .setListener(
                        new com.android.billingclient.api.PurchasesUpdatedListener({
                            onPurchasesUpdated: (result, purchases: java.util.List<com.android.billingclient.api.Purchase>) => {
                                this._purchaseHandler(result.getResponseCode(), purchases);
                            }
                        })
                    )
                    .build();
                this.notify({
                    eventName: PaymentEvent.EventName,
                    context: PaymentEvent.Context.CONNECTING_STORE,
                    result: PaymentEvent.Result.PENDING,
                    payload: null
                });
                _billingClient.startConnection(
                    new com.android.billingclient.api.BillingClientStateListener({
                        onBillingSetupFinished: (result: com.android.billingclient.api.BillingResult) => {
                            const resultCode = result.getResponseCode();
                            if (_billingClient) {
                                if (resultCode === com.android.billingclient.api.BillingClient.BillingResponseCode.OK) {
                                    // use this boolean so the user can call `canMakePayments()`
                                    _isBillingAvailable = true;
                                    _billingClient.queryPurchaseHistoryAsync(
                                        com.android.billingclient.api.BillingClient.SkuType.INAPP,
                                        new com.android.billingclient.api.PurchaseHistoryResponseListener({
                                            onPurchaseHistoryResponse: (historyResult, purchaseList) => {
                                                const responseCode = historyResult.getResponseCode();
                                                this._purchaseHandler(responseCode, purchaseList, com.android.billingclient.api.BillingClient.SkuType.INAPP);
                                                this.notify({
                                                    eventName: PaymentEvent.EventName,
                                                    context: PaymentEvent.Context.CONNECTING_STORE,
                                                    result: PaymentEvent.Result.SUCCESS,
                                                    payload: null
                                                });
                                            }
                                        })
                                    );
                                    _billingClient.queryPurchaseHistoryAsync(
                                        com.android.billingclient.api.BillingClient.SkuType.SUBS,
                                        new com.android.billingclient.api.PurchaseHistoryResponseListener({
                                            onPurchaseHistoryResponse: (historyResult, purchaseList) => {
                                                const responseCode = historyResult.getResponseCode();
                                                this._purchaseHandler(responseCode, purchaseList, com.android.billingclient.api.BillingClient.SkuType.SUBS);
                                                this.notify({
                                                    eventName: PaymentEvent.EventName,
                                                    context: PaymentEvent.Context.CONNECTING_STORE,
                                                    result: PaymentEvent.Result.SUCCESS,
                                                    payload: null
                                                });
                                            }
                                        })
                                    );
                                } else {
                                    const code = _mapBillingResponseCode(resultCode);
                                    console.log(new Error(`🛑 In App Billing Response Error Code: ${resultCode} - ${code}`));
                                    if (resultCode === com.android.billingclient.api.BillingClient.BillingResponseCode.BILLING_UNAVAILABLE) {
                                        console.log('The device you are testing on may not have Google Play setup.');
                                    }
                                    // use this boolean so the user can call `canMakePayments()`
                                    _isBillingAvailable = false;
                                    this.notify({
                                        eventName: PaymentEvent.EventName,
                                        context: PaymentEvent.Context.CONNECTING_STORE,
                                        result: PaymentEvent.Result.FAILURE,
                                        payload: new Failure(resultCode)
                                    });
                                }
                            } else {
                                console.error(new Error('BillingClient missing.'));
                            }
                        },
                        onBillingServiceDisconnected(): void {
                            console.log('Billing Service disconnected.');
                            // .startConnection // TODO Handle retrying connection ?
                        }
                    })
                );
            } else {
                console.error(new Error('Application context missing.'));
            }
        }
    }

    tearDown() {
        if (_billingClient) {
            _billingClient.endConnection();
        }
        _billingClient = null;
    }

    fetchItems(itemIds: string[]) {
        return this._fetchProducts(itemIds, com.android.billingclient.api.BillingClient.SkuType.INAPP);
    }

    fetchSubscriptions(itemIds: string[]) {
        return this._fetchProducts(itemIds, com.android.billingclient.api.BillingClient.SkuType.SUBS);
    }

    _fetchProducts(itemIds: string[], skuType: string) {
        if (_billingClient) {
            this.notify({
                eventName: PaymentEvent.EventName,
                context: PaymentEvent.Context.RETRIEVING_ITEMS,
                result: PaymentEvent.Result.STARTED,
                payload: itemIds
            });

            const skuList = new java.util.ArrayList();
            itemIds.forEach((value) => skuList.add(value));

            // const params = com.android.billingclient.api.SkuDetailsParams.newBuilder();
            // params.setSkusList(skuList).setType(skuType);

            const details = com.android.billingclient.api.QueryProductDetailsParams.newBuilder()
                .setProductList(
                    java.util.Arrays.asList(itemIds.map((id) => com.android.billingclient.api.QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(skuType).build()))
                )
                .build();

            _billingClient.queryProductDetailsAsync(
                details,
                new com.android.billingclient.api.ProductDetailsResponseListener({
                    onProductDetailsResponse(result: com.android.billingclient.api.BillingResult, detailsList: java.util.List<com.android.billingclient.api.ProductDetails>) {
                        const responseCode = result.getResponseCode();
                        if (responseCode === com.android.billingclient.api.BillingClient.BillingResponseCode.OK) {
                            const products = [];
                            const size = detailsList.size();
                            for (let i = 0; i < size; i++) {
                                products.push(new Item(detailsList.get(i)));
                            }
                            this.notify({
                                eventName: PaymentEvent.EventName,
                                context: PaymentEvent.Context.RETRIEVING_ITEMS,
                                result: PaymentEvent.Result.SUCCESS,
                                payload: products
                            });
                        } else {
                            const code = _mapBillingResponseCode(responseCode);
                            console.log(new Error(`Failed to fetch products for purchase: ${responseCode} - ${code}`));
                            this.notify({
                                eventName: PaymentEvent.EventName,
                                context: PaymentEvent.Context.RETRIEVING_ITEMS,
                                result: PaymentEvent.Result.FAILURE,
                                payload: new Failure(responseCode)
                            });
                        }
                    }
                })
            );

            this.notify({
                eventName: PaymentEvent.EventName,
                context: PaymentEvent.Context.RETRIEVING_ITEMS,
                result: PaymentEvent.Result.PENDING,
                payload: itemIds
            });
        } else {
            console.error(new Error('BillingClient missing.'));
        }
    }

    buyItem(item: Item, buyItemOptions?: BuyItemOptions): void {
        return this._startOrder(item, com.android.billingclient.api.BillingClient.SkuType.INAPP, buyItemOptions);
    }
    startSubscription(item: Item, options?: BuyItemOptions) {
        return this._startOrder(item, com.android.billingclient.api.BillingClient.SkuType.SUBS, options);
    }

    _startOrder(item: Item, skuType: string, options?: BuyItemOptions) {
        if (_billingClient) {
            let pendingCount = 0;
            _billingClient.queryPurchasesAsync(
                skuType,
                new com.android.billingclient.api.PurchasesResponseListener({
                    onQueryPurchasesResponse(result: com.android.billingclient.api.BillingResult, pending: java.util.List<com.android.billingclient.api.Purchase>) {
                        // const pending = _billingClient.queryPurchases(skuType).getPurchasesList();
                        if (pending) {
                            pendingCount = pending.size();
                        }
                        if (!pendingCount) {
                            this.notify({
                                eventName: PaymentEvent.EventName,
                                context: PaymentEvent.Context.PROCESSING_ORDER,
                                result: PaymentEvent.Result.PENDING,
                                payload: pendingCount + 1
                            });

                            const paramsBuilder = com.android.billingclient.api.BillingFlowParams.newBuilder();

                            let details;
                            if (skuType === com.android.billingclient.api.BillingClient.SkuType.INAPP) {
                                details = com.android.billingclient.api.BillingFlowParams.ProductDetailsParams.newBuilder()
                                    .setProductDetails(item.nativeValue as com.android.billingclient.api.ProductDetails)
                                    .build();
                            } else if (skuType === com.android.billingclient.api.BillingClient.SkuType.SUBS) {
                                details = com.android.billingclient.api.BillingFlowParams.ProductDetailsParams.newBuilder()
                                    .setProductDetails(item.nativeValue as com.android.billingclient.api.ProductDetails)
                                    .setOfferToken(item.offerToken)
                                    .build();
                            }

                            paramsBuilder.setProductDetailsParamsList(java.util.Arrays.asList([details]));

                            if (options) {
                                if (options?.accountUserName) {
                                    paramsBuilder.setObfuscatedProfileId(options.accountUserName);
                                }

                                if (options?.android?.obfuscatedProfileId) {
                                    paramsBuilder.setObfuscatedProfileId(options.android.obfuscatedProfileId);
                                }

                                if (options?.android?.obfuscatedAccountId) {
                                    paramsBuilder.setObfuscatedAccountId(options.android.obfuscatedAccountId);
                                }
                            }
                            const result = _billingClient.launchBillingFlow(Application.android.foregroundActivity, paramsBuilder.build());
                            const responseCode = result.getResponseCode();
                            if (responseCode === com.android.billingclient.api.BillingClient.BillingResponseCode.OK) {
                                this.notify({
                                    eventName: PaymentEvent.EventName,
                                    context: PaymentEvent.Context.PROCESSING_ORDER,
                                    result: PaymentEvent.Result.STARTED,
                                    payload: item
                                });
                            } else {
                                this.notify({
                                    eventName: PaymentEvent.EventName,
                                    context: PaymentEvent.Context.PROCESSING_ORDER,
                                    result: PaymentEvent.Result.FAILURE,
                                    payload: new Failure(responseCode)
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
                    }
                })
            );
        } else {
            console.error(new Error('BillingClient missing.'));
        }
    }

    finalizeOrder(order: Order): void {
        if (_billingClient) {
            if (order.isSubscription) {
                if (order.acknowledged) {
                    this.notify({
                        eventName: PaymentEvent.EventName,
                        context: PaymentEvent.Context.FINALIZING_ORDER,
                        result: PaymentEvent.Result.SUCCESS,
                        payload: new Order(order.nativeValue, order.restored)
                    });

                    return;
                }

                const params = com.android.billingclient.api.AcknowledgePurchaseParams.newBuilder().setPurchaseToken(order.receiptToken).build();

                _billingClient.acknowledgePurchase(
                    params,
                    new com.android.billingclient.api.AcknowledgePurchaseResponseListener({
                        onAcknowledgePurchaseResponse: (result) => {
                            if (result.getResponseCode() === com.android.billingclient.api.BillingClient.BillingResponseCode.OK) {
                                this.notify({
                                    eventName: PaymentEvent.EventName,
                                    context: PaymentEvent.Context.FINALIZING_ORDER,
                                    result: PaymentEvent.Result.SUCCESS,
                                    payload: new Order(order.nativeValue, order.restored)
                                });
                            } else {
                                this.notify({
                                    eventName: PaymentEvent.EventName,
                                    context: PaymentEvent.Context.FINALIZING_ORDER,
                                    result: PaymentEvent.Result.FAILURE,
                                    payload: new Failure(result.getResponseCode())
                                });
                            }
                        }
                    })
                );
            } else {
                this.notify({
                    eventName: PaymentEvent.EventName,
                    context: PaymentEvent.Context.FINALIZING_ORDER,
                    result: PaymentEvent.Result.STARTED,
                    payload: order
                });
                if (order.state === OrderState.VALID && !order.restored) {
                    const consumeParams = com.android.billingclient.api.ConsumeParams.newBuilder().setPurchaseToken(order.receiptToken).build();
                    _billingClient.consumeAsync(
                        consumeParams,
                        new com.android.billingclient.api.ConsumeResponseListener({
                            onConsumeResponse: (result, purchaseToken) => {
                                const responseCode = result.getResponseCode();
                                if (_billingClient) {
                                    if (responseCode === com.android.billingclient.api.BillingClient.BillingResponseCode.OK) {
                                        this.notify({
                                            eventName: PaymentEvent.EventName,
                                            context: PaymentEvent.Context.FINALIZING_ORDER,
                                            result: PaymentEvent.Result.SUCCESS,
                                            payload: new Order(order.nativeValue, order.restored)
                                        });
                                    } else {
                                        this.notify({
                                            eventName: PaymentEvent.EventName,
                                            context: PaymentEvent.Context.FINALIZING_ORDER,
                                            result: PaymentEvent.Result.FAILURE,
                                            payload: new Failure(responseCode)
                                        });
                                    }

                                    _billingClient.queryPurchasesAsync(
                                        com.android.billingclient.api.BillingClient.SkuType.INAPP,
                                        new com.android.billingclient.api.PurchasesResponseListener({
                                            onQueryPurchasesResponse(param0: com.android.billingclient.api.BillingResult, pending: java.util.List<com.android.billingclient.api.Purchase>) {
                                                this.notify({
                                                    eventName: PaymentEvent.EventName,
                                                    context: PaymentEvent.Context.PROCESSING_ORDER,
                                                    result: PaymentEvent.Result.PENDING,
                                                    payload: pending ? pending.size() : 0
                                                });
                                            }
                                        })
                                    );
                                } else {
                                    console.error(new Error('BillingClient missing.'));
                                }
                            }
                        })
                    );
                    this.notify({
                        eventName: PaymentEvent.EventName,
                        context: PaymentEvent.Context.FINALIZING_ORDER,
                        result: PaymentEvent.Result.PENDING,
                        payload: order
                    });
                } else {
                    this.notify({
                        eventName: PaymentEvent.EventName,
                        context: PaymentEvent.Context.FINALIZING_ORDER,
                        result: PaymentEvent.Result.FAILURE,
                        payload: new Failure(8)
                    });
                }
            }
        } else {
            console.error(new Error('BillingClient missing.'));
        }
    }

    restoreOrders(skuType?: string): void {
        if (_billingClient) {
            this.notify({
                eventName: PaymentEvent.EventName,
                context: PaymentEvent.Context.RESTORING_ORDERS,
                result: PaymentEvent.Result.STARTED,
                payload: null
            });
            if (skuType === 'sub') {
                skuType = com.android.billingclient.api.BillingClient.SkuType.SUBS;
            } else {
                skuType = com.android.billingclient.api.BillingClient.SkuType.INAPP;
            }
            _billingClient.queryPurchaseHistoryAsync(
                skuType,
                new com.android.billingclient.api.PurchaseHistoryResponseListener({
                    onPurchaseHistoryResponse: (result, purchasesList) => {
                        const responseCode = result.getResponseCode();
                        if (responseCode === com.android.billingclient.api.BillingClient.BillingResponseCode.OK) {
                            const size = purchasesList.size();
                            for (let i = 0; i < size; i++) {
                                const purchase: com.android.billingclient.api.PurchaseHistoryRecord = purchasesList.get(i);
                                if (purchase) {
                                    this.notify({
                                        eventName: PaymentEvent.EventName,
                                        context: PaymentEvent.Context.PROCESSING_ORDER,
                                        result: PaymentEvent.Result.SUCCESS,
                                        payload: new Order(purchase, true)
                                    });
                                    this.notify({
                                        eventName: PaymentEvent.EventName,
                                        context: PaymentEvent.Context.RESTORING_ORDERS,
                                        result: PaymentEvent.Result.PENDING,
                                        payload: new Order(purchase, true)
                                    });
                                }
                            }
                            this.notify({
                                eventName: PaymentEvent.EventName,
                                context: PaymentEvent.Context.RESTORING_ORDERS,
                                result: PaymentEvent.Result.SUCCESS,
                                payload: null
                            });
                        } else {
                            this.notify({
                                eventName: PaymentEvent.EventName,
                                context: PaymentEvent.Context.RESTORING_ORDERS,
                                result: PaymentEvent.Result.FAILURE,
                                payload: new Failure(responseCode)
                            });
                        }
                    }
                })
            );
        } else {
            console.error(new Error('BillingClient missing.'));
        }
    }

    canMakePayments(/*types*/): boolean {
        if (_billingClient) {
            return _isBillingAvailable;
        } else {
            console.log('🛑 Call `init` prior to checking if the payments are configured correctly. 🛑');
            return false;
        }
    }

    _purchaseHandler(responseCode: number, purchases: List<com.android.billingclient.api.Purchase | com.android.billingclient.api.PurchaseHistoryRecord>, skuType?: string) {
        if (_billingClient) {
            const pending = purchases;
            if (!skuType) {
                _billingClient.queryPurchasesAsync(
                    com.android.billingclient.api.BillingClient.SkuType.INAPP,
                    new com.android.billingclient.api.PurchasesResponseListener({
                        onQueryPurchasesResponse(param0: com.android.billingclient.api.BillingResult, pending: java.util.List<com.android.billingclient.api.Purchase>) {
                            if (responseCode === com.android.billingclient.api.BillingClient.BillingResponseCode.OK) {
                                const size = purchases?.size?.() ?? 0;
                                if (purchases && size) {
                                    for (let i = 0; i < size; i++) {
                                        const purchase: com.android.billingclient.api.Purchase | com.android.billingclient.api.PurchaseHistoryRecord = purchases.get(i);
                                        if (purchase) {
                                            const order = new Order(purchase, false);
                                            // order.isSubscription = isSubscription;
                                            this.notify({
                                                eventName: PaymentEvent.EventName,
                                                context: PaymentEvent.Context.PROCESSING_ORDER,
                                                result: PaymentEvent.Result.SUCCESS,
                                                payload: order
                                            });
                                        }
                                    }
                                }
                            } else {
                                this.notify({
                                    eventName: PaymentEvent.EventName,
                                    context: PaymentEvent.Context.PROCESSING_ORDER,
                                    result: PaymentEvent.Result.FAILURE,
                                    payload: new Failure(responseCode)
                                });
                            }
                        }
                    })
                );
            }
            // var isSubscription = skuType === com.android.billingclient.api.BillingClient.SkuType.SUBS;
            this.notify({
                eventName: PaymentEvent.EventName,
                context: PaymentEvent.Context.PROCESSING_ORDER,
                result: PaymentEvent.Result.PENDING,
                payload: pending ? pending.size() : 0
            });
        } else {
            console.error(new Error('BillingClient missing.'));
        }
    }
}

function _mapBillingResponseCode(code: number) {
    switch (code) {
        case 0:
            return 'OK';
        case 1:
            return 'USER_CANCELED';

        case 2:
            return 'SERVICE_UNAVAILABLE';

        case 3:
            return 'BILLING_UNAVAILABLE';

        case 4:
            return 'ITEM_UNAVAILABLE';

        case 5:
            return 'DEVELOPER_ERROR';

        case 6:
            return 'ERROR';

        case 7:
            return 'ITEM_ALREADY_OWNED';

        case 8:
            return 'ITEM_NOT_OWNED';

        case -1:
            return 'SERVICE_DISCONNECTED';

        case -2:
            return 'FEATURE_NOT_SUPPORTED';

        case -3:
            return 'SERVICE_TIMEOUT';
        default:
            return '';
    }
}
