import Razorpay from 'razorpay';

const { VITE_RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret } = process.env;

if (!keyId || !keySecret) {
    console.error('Set VITE_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET before running this script.');
    process.exit(1);
}

const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
});

async function createPlans() {
    console.log('Creating Razorpay plans...');

    try {
        const basicPlan = await razorpay.plans.create({
            period: 'monthly',
            interval: 1,
            item: {
                name: 'Qook Basic',
                amount: 4900,
                currency: 'INR',
                description: 'Basic Monthly Subscription',
            },
        });
        console.log('BASIC_PLAN_ID:', basicPlan.id);

        const proPlan = await razorpay.plans.create({
            period: 'monthly',
            interval: 1,
            item: {
                name: 'Qook Pro',
                amount: 9900,
                currency: 'INR',
                description: 'Pro Monthly Subscription',
            },
        });
        console.log('PRO_PLAN_ID:', proPlan.id);
    } catch (error) {
        console.error('Error creating plans:', error);
        process.exit(1);
    }
}

createPlans();
