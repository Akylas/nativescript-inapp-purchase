import { BaseItem } from './common';
export { RecurrenceMode } from './common';

export class Item extends BaseItem {
    public nativeValue: SKProduct;

    constructor(nativeValue: SKProduct) {
        super(nativeValue);

        const formatter = NSNumberFormatter.alloc().init();
        formatter.numberStyle = NSNumberFormatterStyle.CurrencyStyle;
        formatter.locale = nativeValue.priceLocale;

        this.itemId = nativeValue.productIdentifier;
        this.localizedDescription = nativeValue.localizedDescription;
        this.localizedTitle = nativeValue.localizedTitle;
        this.priceAmount = nativeValue.price.doubleValue;
        this.priceFormatted = formatter.stringFromNumber(nativeValue.price as any);
        this.priceCurrencyCode = nativeValue.priceLocale.objectForKey(NSLocaleCurrencyCode) as string;
        this.isFamilyShareable = nativeValue.isFamilyShareable;
    }

    public get debug(): string | null {
        if (this.nativeValue) {
            const temp: any = {};
            for (const i in this.nativeValue) {
                if ((this.nativeValue as any)[i] != null) {
                    temp[i] = (this.nativeValue as any)[i];
                }
            }

            return JSON.stringify(temp);
        } else {
            return null;
        }
    }
}
