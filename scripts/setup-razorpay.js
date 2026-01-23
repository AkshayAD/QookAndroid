import Razorpay from 'razorpay';

// Keys provided by user
const KEY_ID = 'rzp_test_S2ScSFa6zTavtM';
const KEY_SECRET = 'dCHVIiomg7YMxQ0Okx1pLp4u';

const razorpay = new Razorpay({
    key_id: KEY_ID,
    key_secret: KEY_SECRET,
});

async function createPlans() {
    console.log('Creating Razorpay Plans...');

    try {
        // 1. Basic Plan
        const basicPlan = await razorpay.plans.create({
            period: 'monthly',
            interval: 1,
            item: {
                name: 'Cook Commander Basic',
                amount: 4900, // in paise (49 INR)
                currency: 'INR',
                description: 'Basic Monthly Subscription'
            }
        });
        console.log('BASIC_PLAN_ID:', basicPlan.id);

        // 2. Pro Plan
        const proPlan = await razorpay.plans.create({
            period: 'monthly',
            interval: 1,
            item: {
                name: 'Cook Commander Pro',
                amount: 9900, // in paise (99 INR)
                currency: 'INR',
                description: 'Pro Monthly Subscription'
            }
        });
        console.log('PRO_PLAN_ID:', proPlan.id);

    } catch (error) {
        console.error('Error creating plans:', error);
    }
}

createPlans();
