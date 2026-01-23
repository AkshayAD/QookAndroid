import { UserPreferences, PreferenceProfile } from './types';

// Quick cook instruction options (unticked by default)
export const QUICK_COOK_INSTRUCTION_OPTIONS = [
  "If Lunch is Chole/Rajma, Dinner should be lighter",
  "Avoid deep fried items on weekdays",
  "Keep oil/ghee usage minimal",
  "Prefer fresh grinding over store-bought masalas",
  "No repeat meals within a week",
  "Include salad with every lunch",
  "Prefer homemade paneer if available"
];

// Extracted from the provided WhatsApp chat history
export const DEFAULT_PREFERENCES: UserPreferences = {
  dietaryType: "Vegetarian",
  dietaryTypes: ["Vegetarian"],
  dietaryDetails: "",
  allergies: [],
  dislikes: [
    "Carrot Matar Sabzi",
    "Beetroot Sabzi (Only allowed in Salad)",
    "Gawar (Cluster Beans)",
    "Arbi Masala (Dry)",
    "Mooli dishes (Only allowed in Salad)"
  ],
  breakfastPreferences: [
    "Vegetable Sandwich with Cheese",
    "Pasta with Broccoli",
    "Idli with Sambar & Coconut/Peanut Chutney",
    "Besan Cheela with Grated Paneer",
    "Veggie Uttapam",
    "Poha (Paneer Poha)",
    "Upma (Vermicelli/Rava)",
    "Stuffed Paratha (Gobi, Palak, Methi) with Curd",
    "Dhokla",
    "Moong Dal Cheela",
    "Fruits: Cut Apple, Papaya, Guava, Pineapple, Orange"
  ],
  lunchPreferences: [
    "Staples: Plain Roti/Paratha, Rice (Jeera/Steamed)",
    "Sabzi: Aloo Gobi, Bhindi, Cabbage & Peas, Lauki Kofta, Mix Veg, Mushroom Matar",
    "Dal: Methi Toor Dal, Arhar Dal Tadka, Chana Dal, Rajma, Chole, Kadhi Pakoda",
    "Salad: Cucumber, Carrot, Beetroot, Onion, Tomato (Mandatory at lunch)",
    "Specials: Lemon Rice, Bhature (Sundays)"
  ],
  dinnerPreferences: [
    "Lighter/Special Meals",
    "Paneer: Palak Paneer, Paneer Bhurji, Shahi Paneer, Kadai Paneer (Limit Paneer frequency)",
    "Rice: Veg Pulao, Soya Pulao, Veg Biryani, Khichdi",
    "Egg: Egg Bhurji, Egg Curry, Egg Rolls",
    "Chinese: Hakka Noodles, Manchurian, Fried Rice",
    "Others: Sarson ka Saag & Makki Roti (Winter), Pav Bhaji, Wraps",
    "Sides: Raita (Boondi, Onion Tomato)"
  ],
  specialInstructions: "Cook visits twice a day: Morning (Breakfast+Lunch), Evening (Dinner).",
  pantryStaples: [
    "Salt", "Sugar", "Oil", "Spices (Haldi, Mirch, Jeera, etc.)", "Wheat Flour (Atta)", "Rice"
  ],
  mealsToPrepare: ['breakfast', 'lunch', 'dinner'],
  nonVegPreferences: [],
  language: 'English',
  quickCookInstructions: []
};

// Default profile templates for new users
export const DEFAULT_PROFILE_TEMPLATES: Omit<PreferenceProfile, 'id'>[] = [
  {
    name: 'North Indian',
    dietaryType: 'Vegetarian',
    allergies: [],
    dislikes: [],
    breakfastPreferences: [
      'Aloo Paratha with Curd',
      'Poha with Sev',
      'Chole Bhature',
      'Stuffed Paratha (Gobi, Paneer)',
      'Besan Cheela',
      'Bread Pakora',
      'Halwa Puri'
    ],
    lunchPreferences: [
      'Dal Makhani with Jeera Rice',
      'Rajma Chawal',
      'Chole with Roti',
      'Kadhi Pakoda with Rice',
      'Aloo Gobi with Roti',
      'Mix Veg with Paratha',
      'Paneer Butter Masala with Naan'
    ],
    dinnerPreferences: [
      'Palak Paneer with Roti',
      'Dal Tadka with Rice',
      'Aloo Matar with Paratha',
      'Khichdi with Papad',
      'Veg Pulao with Raita',
      'Paneer Tikka with Roti'
    ],
    specialInstructions: 'Focus on North Indian flavors. Use ghee for tadka.',
    pantryStaples: ['Atta', 'Rice', 'Dal', 'Ghee', 'Spices', 'Paneer']
  },
  {
    name: 'South Indian',
    dietaryType: 'Vegetarian',
    allergies: [],
    dislikes: [],
    breakfastPreferences: [
      'Idli with Sambar & Chutney',
      'Masala Dosa with Chutney',
      'Upma with Coconut Chutney',
      'Medu Vada with Sambar',
      'Pongal with Coconut Chutney',
      'Uttapam with Sambar',
      'Pesarattu with Ginger Chutney'
    ],
    lunchPreferences: [
      'Sambar Rice with Papad',
      'Rasam Rice with Curd',
      'Curd Rice with Pickle',
      'Lemon Rice with Raita',
      'Tamarind Rice with Papad',
      'Bisibele Bath',
      'Veg Kurma with Chapati'
    ],
    dinnerPreferences: [
      'Dosa with Sambar',
      'Appam with Coconut Milk',
      'Idiyappam with Kurma',
      'Tomato Rice with Raita',
      'Light Rasam Rice',
      'Set Dosa with Chutney Varieties'
    ],
    specialInstructions: 'Use coconut oil and curry leaves. Fresh chutneys daily.',
    pantryStaples: ['Rice', 'Urad Dal', 'Coconut', 'Curry Leaves', 'Mustard', 'Tamarind']
  },
  {
    name: 'Maharashtrian',
    dietaryType: 'Vegetarian',
    allergies: [],
    dislikes: [],
    breakfastPreferences: [
      'Pohe with Sev & Lemon',
      'Upma with Coconut',
      'Misal Pav',
      'Thalipeeth with Curd',
      'Sabudana Khichdi',
      'Batata Vada with Chutney',
      'Kanda Pohe'
    ],
    lunchPreferences: [
      'Puran Poli with Ghee',
      'Amti with Rice',
      'Bhakri with Pitla',
      'Masale Bhaat',
      'Bharli Vangi with Bhakri',
      'Zunka Bhakri',
      'Matki Usal with Rice'
    ],
    dinnerPreferences: [
      'Pav Bhaji',
      'Varan Bhaat with Toop',
      'Batata Bhaji with Chapati',
      'Sol Kadhi with Rice',
      'Usal Pav',
      'Kothimbir Vadi with Chutney'
    ],
    specialInstructions: 'Use peanut oil. Include kokum and hing in cooking.',
    pantryStaples: ['Jowar Flour', 'Bajra Flour', 'Peanuts', 'Kokum', 'Jaggery', 'Hing']
  },
  {
    name: 'Healthy & Diet',
    dietaryType: 'Vegetarian (High Protein)',
    allergies: [],
    dislikes: ['Fried foods', 'Heavy curries', 'White rice'],
    breakfastPreferences: [
      'Oats with Fruits & Nuts',
      'Sprouts Salad',
      'Vegetable Smoothie Bowl',
      'Moong Dal Cheela with Veggies',
      'Multigrain Toast with Avocado',
      'Greek Yogurt with Berries',
      'Ragi Dosa with Sambar'
    ],
    lunchPreferences: [
      'Brown Rice with Dal & Salad',
      'Quinoa Salad with Paneer',
      'Grilled Vegetables with Hummus',
      'Chapati with Mixed Dal',
      'Buddha Bowl with Chickpeas',
      'Jowar Roti with Sabzi',
      'Vegetable Soup with Multigrain Bread'
    ],
    dinnerPreferences: [
      'Grilled Paneer with Vegetables',
      'Clear Soup with Salad',
      'Steamed Vegetables with Tofu',
      'Light Khichdi with Kadhi',
      'Vegetable Stir Fry',
      'Soup and Salad Combo'
    ],
    specialInstructions: 'Avoid oil-heavy cooking. Steam or grill. Include protein in every meal.',
    pantryStaples: ['Oats', 'Quinoa', 'Brown Rice', 'Sprouts', 'Nuts', 'Seeds']
  },
  {
    name: 'Quick & Easy',
    dietaryType: 'Vegetarian',
    allergies: [],
    dislikes: ['Complex dishes', 'Long cooking time recipes'],
    breakfastPreferences: [
      'Bread Toast with Butter',
      'Cornflakes with Milk',
      'Instant Poha',
      'Sandwich',
      'Paratha (ready-made)',
      'Maggi Noodles',
      'Fruits with Curd'
    ],
    lunchPreferences: [
      'Dal Rice (Simple)',
      'Jeera Rice with Raita',
      'Egg Curry with Rice',
      'Chapati with Aloo Sabzi',
      'Fried Rice (quick style)',
      'Khichdi',
      'Pav Bhaji (quick version)'
    ],
    dinnerPreferences: [
      'Maggi with Vegetables',
      'Instant Pasta',
      'Egg Bhurji with Roti',
      'Quick Pulao',
      'Cheese Toast',
      'Simple Dalia'
    ],
    specialInstructions: 'Keep recipes simple. Max 20-30 mins cooking time.',
    pantryStaples: ['Instant items', 'Bread', 'Eggs', 'Ready-to-eat packets', 'Maggi', 'Pasta']
  }
];