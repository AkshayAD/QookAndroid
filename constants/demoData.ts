import { WeeklyPlan, GroceryItem } from '../types';

// Demo meal plan for walkthrough - realistic Indian meals
export const DEMO_MEAL_PLAN: WeeklyPlan = {
    days: [
        {
            day: "Monday",
            breakfast: "Masala Dosa with Coconut Chutney and Sambar",
            lunch: "Rajma Chawal with Cucumber Raita",
            dinner: "Paneer Butter Masala with Butter Naan"
        },
        {
            day: "Tuesday",
            breakfast: "Poha with Peanuts and Sev",
            lunch: "Chole Bhature with Onion Salad",
            dinner: "Mixed Vegetable Pulao with Dal Tadka"
        },
        {
            day: "Wednesday",
            breakfast: "Idli with Coconut Chutney and Sambar",
            lunch: "Aloo Gobi with Chapati and Dal",
            dinner: "Palak Paneer with Jeera Rice"
        },
        {
            day: "Thursday",
            breakfast: "Upma with Coconut Chutney",
            lunch: "Dal Makhani with Steamed Rice",
            dinner: "Kadai Paneer with Garlic Naan"
        },
        {
            day: "Friday",
            breakfast: "Paratha with Curd and Pickle",
            lunch: "Sambar Rice with Papad",
            dinner: "Mushroom Masala with Chapati"
        },
        {
            day: "Saturday",
            breakfast: "Uttapam with Tomato Chutney",
            lunch: "Bisi Bele Bath with Boondi Raita",
            dinner: "Malai Kofta with Butter Roti"
        },
        {
            day: "Sunday",
            breakfast: "Puri Bhaji with Halwa",
            lunch: "Biryani with Raita and Salan",
            dinner: "Chana Masala with Rice"
        }
    ]
};

// Demo grocery list for walkthrough
export const DEMO_GROCERY_LIST: GroceryItem[] = [
    { category: 'Grains', item: 'Basmati Rice', quantity: '2 kg', checked: false },
    { category: 'Vegetables', item: 'Onions', quantity: '1 kg', checked: false },
    { category: 'Vegetables', item: 'Tomatoes', quantity: '500 g', checked: false },
    { category: 'Dairy', item: 'Paneer', quantity: '500 g', checked: false },
    { category: 'Dairy', item: 'Curd', quantity: '500 ml', checked: false },
    { category: 'Spices', item: 'Ginger-Garlic Paste', quantity: '100 g', checked: false },
    { category: 'Spices', item: 'Cumin Seeds', quantity: '50 g', checked: false },
    { category: 'Spices', item: 'Garam Masala', quantity: '50 g', checked: false },
    { category: 'Pulses', item: 'Chickpeas (Chana)', quantity: '500 g', checked: false },
    { category: 'Pulses', item: 'Toor Dal', quantity: '500 g', checked: false },
    { category: 'Grains', item: 'Atta (Wheat Flour)', quantity: '5 kg', checked: false },
    { category: 'Vegetables', item: 'Potatoes', quantity: '1 kg', checked: false },
];
