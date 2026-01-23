
// Start of Selection
import { supabase } from '../lib/supabase';
import { getApiBaseUrl } from '../utils/platform';

// Inline loadScript to avoid import issues
const loadScript = (src: string): Promise<boolean> => {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

interface RazorpayOrderProps {
    amount: number; // in INR
    packId: string;
}

interface RazorpaySubscriptionProps {
    planId: string; // Razorpay Plan ID
    internalPlanId: string; // Internal ID (basic/pro)
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
    const res = await loadScript('https://checkout.razorpay.com/v1/checkout.js');
    if (!res) {
        options.onError('Razorpay SDK failed to load');
        return;
    }

    try {
        let orderData: any;
        const isSubscription = options.type === 'subscription';

        // 1. Create Order / Subscription via API
        if (isSubscription) {
            const item = options.item as RazorpaySubscriptionProps;
            const response = await fetch(`${getApiBaseUrl()}/api/create-subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan_id: item.planId,
                    internal_plan_id: item.internalPlanId, // For offer lookup
                    apply_first_month_discount: true
                })
            });
            orderData = await response.json();

            if (!orderData.id) throw new Error('Failed to create subscription');

        } else {
            const item = options.item as RazorpayOrderProps;
            const response = await fetch(`${getApiBaseUrl()}/api/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount_inr: item.amount,
                    pack_id: item.packId
                })
            });
            orderData = await response.json();

            if (!orderData.id) throw new Error('Failed to create order');
        }

        // 2. Open Razorpay Checkout
        const rzpOptions = {
            key: import.meta.env.VITE_RAZORPAY_KEY_ID,
            amount: !isSubscription ? (options.item as RazorpayOrderProps).amount * 100 : undefined,
            currency: 'INR',
            name: 'Cook Commander',
            description: isSubscription ? 'Subscription Upgrade' : 'Credit Pack Purchase',
            order_id: !isSubscription ? orderData.id : undefined,
            subscription_id: isSubscription ? orderData.id : undefined,
            handler: async function (response: any) {
                // 3. Verify Payment on Success

                const verifyBody = {
                    user_id: userId,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                    razorpay_subscription_id: response.razorpay_subscription_id,
                    type: options.type,
                    plan_id: isSubscription ? (options.item as RazorpaySubscriptionProps).internalPlanId : (options.item as RazorpayOrderProps).packId
                };

                try {
                    const verifyRes = await fetch(`${getApiBaseUrl()}/api/verify-payment`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(verifyBody)
                    });

                    const verifyData = await verifyRes.json();

                    if (verifyData.success) {
                        options.onSuccess();
                    } else {
                        options.onError('Payment verification failed');
                    }
                } catch (err) {
                    options.onError(err);
                }
            },
            prefill: {
                // Prefill user details if available
                // name: user.name,
                // email: user.email 
            },
            theme: {
                color: '#F97316' // Orange-500
            }
        };

        const rzp1 = new (window as any).Razorpay(rzpOptions);
        rzp1.on('payment.failed', function (response: any) {
            options.onError(response.error);
        });
        rzp1.open();

    } catch (error) {
        options.onError(error);
    }
};
