import { supabase } from '../lib/supabase';
import { getApiBaseUrl, isNative } from '../utils/platform';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

interface RazorpayOrderProps {
  amount: number;
  packId: string;
}

interface RazorpaySubscriptionProps {
  planId: string;
  internalPlanId: string;
}

export interface RazorpayOrderData {
  amount: number;
  currency: string;
  order_id?: string;
  key_id?: string;
  id?: string;
  plan_type?: string;
  credits?: number;
  monthly_credits?: number;
  bonus_credits?: number;
}

export interface RazorpaySubscriptionData {
  subscription_id?: string;
  key_id?: string;
  amount?: number;
  currency?: string;
  name?: string;
  description?: string;
  prefill?: {
    email?: string;
    contact?: string;
  };
  id?: string;
}

export interface VerifyPaymentPayload {
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  razorpay_subscription_id?: string;
  user_id: string;
  userId?: string;
  type?: 'pack' | 'subscription';
  plan_type?: string;
  plan_id?: string;
  amount?: number;
  billing_cycle?: 'monthly' | 'yearly';
}

async function getRequestHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  return headers;
}

function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function createRazorpayOrder(
  userId: string,
  packId: string
): Promise<RazorpayOrderData> {
  const response = await fetch(`${getApiBaseUrl()}/api/create-order`, {
    method: 'POST',
    headers: await getRequestHeaders(),
    body: JSON.stringify({
      user_id: userId,
      userId,
      pack_id: packId,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to create order');
  }

  return data;
}

export async function createRazorpaySubscription(
  userId: string,
  internalPlanId: string,
  email: string,
): Promise<RazorpaySubscriptionData> {
  const response = await fetch(`${getApiBaseUrl()}/api/create-subscription`, {
    method: 'POST',
    headers: await getRequestHeaders(),
    body: JSON.stringify({
      user_id: userId,
      userId,
      internal_plan_id: internalPlanId,
      email,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to create subscription');
  }

  return data;
}

export async function verifyRazorpayPayment(payload: VerifyPaymentPayload): Promise<any> {
  const response = await fetch(`${getApiBaseUrl()}/api/verify-payment`, {
    method: 'POST',
    headers: await getRequestHeaders(),
    body: JSON.stringify({
      ...payload,
      userId: payload.userId || payload.user_id,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || 'Payment verification failed');
  }

  return data;
}

export const initializeRazorpayPayment = async (
  userId: string,
  options: {
    type: 'pack' | 'subscription';
    item: RazorpayOrderProps | RazorpaySubscriptionProps;
    onSuccess: () => void;
    onError: (err: any) => void;
  }
) => {
  if (isNative()) {
    options.onError('Payments for the Android app must use Google Play Billing. Please use qook.in on the web while Android billing is being enabled.');
    return;
  }

  if (!import.meta.env.VITE_RAZORPAY_KEY_ID) {
    options.onError('Payment configuration is missing. Please contact support.');
    return;
  }

  const loaded = await loadScript('https://checkout.razorpay.com/v1/checkout.js');

  if (!loaded) {
    options.onError('Razorpay SDK failed to load');
    return;
  }

  try {
    const isSubscription = options.type === 'subscription';
    let orderData: any;

    if (isSubscription) {
      const item = options.item as RazorpaySubscriptionProps;
      const { data: { user } } = await supabase.auth.getUser();
      orderData = await createRazorpaySubscription(
        userId,
        item.internalPlanId,
        user?.email || ''
      );
      if (!orderData?.subscription_id && !orderData?.id) {
        throw new Error('Failed to create subscription');
      }
    } else {
      const item = options.item as RazorpayOrderProps;
      orderData = await createRazorpayOrder(userId, item.packId);
      if (!orderData?.id) {
        throw new Error('Failed to create order');
      }
    }

    const rzpOptions = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: !isSubscription ? orderData.amount : undefined,
      currency: 'INR',
      name: 'Qook',
      description: isSubscription ? 'Subscription Upgrade' : 'Credit Pack Purchase',
      order_id: !isSubscription ? orderData.id || orderData.order_id : undefined,
      subscription_id: isSubscription ? orderData.subscription_id || orderData.id : undefined,
      handler: async (response: any) => {
        try {
          const verifyData = await verifyRazorpayPayment({
            user_id: userId,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
            razorpay_subscription_id: response.razorpay_subscription_id,
            type: options.type,
          });

          if (verifyData?.success !== false) {
            options.onSuccess();
            return;
          }

          options.onError('Payment verification failed');
        } catch (error) {
          options.onError(error);
        }
      },
      prefill: {},
      theme: {
        color: '#F97316',
      },
    };

    const razorpay = new window.Razorpay(rzpOptions);
    razorpay.on('payment.failed', (response: any) => {
      options.onError(response.error);
    });
    razorpay.open();
  } catch (error) {
    options.onError(error);
  }
};
