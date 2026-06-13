export type PlayBillingSubscriptionPlanId = 'byok' | 'basic' | 'pro' | 'family_pro';
export type PlayBillingCreditPackId = 'starter' | 'popular' | 'value' | 'mega';

export type PlayBillingProductKind = 'subscription' | 'consumable';

export interface PlayBillingProductMapping {
  readonly kind: PlayBillingProductKind;
  readonly internalId: PlayBillingSubscriptionPlanId | PlayBillingCreditPackId;
  readonly productId: string;
}

export interface PlayBillingPurchaseToken {
  readonly productId: string;
  readonly purchaseToken: string;
  readonly orderId?: string;
}

export interface PlayBillingClient {
  getProducts(): Promise<readonly PlayBillingProductMapping[]>;
  purchaseSubscription(planId: PlayBillingSubscriptionPlanId): Promise<PlayBillingPurchaseToken>;
  purchaseCreditPack(packId: PlayBillingCreditPackId): Promise<PlayBillingPurchaseToken>;
}

export const PLAY_BILLING_PRODUCTS: readonly PlayBillingProductMapping[] = [
  { kind: 'subscription', internalId: 'byok', productId: 'qook_sub_byok_29' },
  { kind: 'subscription', internalId: 'basic', productId: 'qook_sub_basic_49' },
  { kind: 'subscription', internalId: 'pro', productId: 'qook_sub_pro_99' },
  { kind: 'subscription', internalId: 'family_pro', productId: 'qook_sub_family_pro_149' },
  { kind: 'consumable', internalId: 'starter', productId: 'qook_credits_starter_3_19' },
  { kind: 'consumable', internalId: 'popular', productId: 'qook_credits_popular_8_49' },
  { kind: 'consumable', internalId: 'value', productId: 'qook_credits_value_20_99' },
  { kind: 'consumable', internalId: 'mega', productId: 'qook_credits_mega_50_199' },
];
