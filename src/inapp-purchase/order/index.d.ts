import { BaseOrder } from './common';

export { OrderState } from './common';

export declare class Order extends BaseOrder {
    public readonly debug: string | null;

    constructor(nativeValue: com.android.billingclient.api.Purchase | com.android.billingclient.api.PurchaseHistoryRecord | SKPaymentTransaction, restored?: boolean);
}
