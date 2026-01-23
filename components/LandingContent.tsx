import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Sparkles, ChefHat, ArrowRight, Utensils, Leaf, Users, Clock, Calendar, ShoppingBag } from 'lucide-react';

export default function LandingContent() {
    const triggerAuth = () => {
        window.dispatchEvent(new CustomEvent('openAuth'));
    };

    // Custom scroll handler for anchor links
    const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
        e.preventDefault();
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <>
            {/* Hero Section */}
            <section className="relative pt-8 pb-16 lg:pt-16 lg:pb-24 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-orange-200/30 rounded-full blur-3xl -z-10 opacity-50 pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-100 text-orange-700 text-xs font-bold uppercase tracking-wide mb-6">
                        <Sparkles className="w-3 h-3" />
                        <span>AI-Powered Kitchen Assistant</span>
                    </div>

                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 mb-6 leading-[1.1]">
                        Master Your Kitchen <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-red-600">Without the Chaos</span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
                        Stop worrying about "what's for dinner". Get personalized weekly meal plans and organized grocery lists in seconds.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                        <button
                            onClick={triggerAuth}
                            className="w-full sm:w-auto px-8 py-4 bg-gray-900 text-white font-bold rounded-full hover:bg-gray-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-2 group"
                        >
                            Start Planning Free
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    {/* Social Proof */}
                    <div className="flex flex-wrap justify-center gap-6 md:gap-12 opacity-80">
                        {['100% Personalized', 'Saves 2+ Hours/Week', 'Zero Food Waste'].map((stat, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                <span className="font-semibold text-gray-700 text-sm md:text-base">{stat}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* VALUE SHOWCASE - Main Output Display */}
            <section className="py-16 bg-gradient-to-b from-white to-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <span className="text-orange-600 font-bold tracking-wide uppercase text-sm">This Is What You Get</span>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2 mb-4">Beautiful, Shareable Meal Plans</h2>
                        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                            AI-generated weekly menus and organized grocery lists. Share with your family.
                        </p>
                    </div>

                    {/* Simple 3-Step Flow */}
                    <div className="flex justify-center gap-4 md:gap-8 mb-10 text-center">
                        <div className="flex flex-col items-center">
                            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold mb-2">1</div>
                            <span className="text-sm text-gray-600 font-medium">Set Preferences</span>
                        </div>
                        <div className="flex items-center text-gray-300">→</div>
                        <div className="flex flex-col items-center">
                            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold mb-2">2</div>
                            <span className="text-sm text-gray-600 font-medium">AI Generates Plan</span>
                        </div>
                        <div className="flex items-center text-gray-300">→</div>
                        <div className="flex flex-col items-center">
                            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold mb-2">3</div>
                            <span className="text-sm text-gray-600 font-medium">Shop & Cook</span>
                        </div>
                    </div>

                    {/* Output Cards - Side by Side */}
                    <div className="relative max-w-4xl mx-auto">
                        <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-center justify-center">
                            {/* Weekly Menu Card */}
                            <div className="w-full md:w-1/2 transform md:-rotate-2 hover:rotate-0 transition-transform duration-500">
                                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-white">
                                    <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 text-white text-sm font-semibold">
                                        Weekly Menu
                                    </div>
                                    <div className="relative h-64 overflow-hidden">
                                        <img
                                            src={`${import.meta.env.BASE_URL}Weekly Menu.png`}
                                            alt="Weekly Meal Plan"
                                            className="w-full h-auto"
                                        />
                                        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white via-white/90 to-transparent" />
                                    </div>
                                </div>
                            </div>

                            {/* Grocery List Card */}
                            <div className="w-full md:w-1/2 transform md:rotate-2 hover:rotate-0 transition-transform duration-500">
                                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-white">
                                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 text-white text-sm font-semibold">
                                        Grocery List
                                    </div>
                                    <div className="relative h-64 overflow-hidden">
                                        <img
                                            src={`${import.meta.env.BASE_URL}qookcommander-grocery-Feb-1---Feb-7,-2026.png`}
                                            alt="Organized Grocery List"
                                            className="w-full h-auto"
                                        />
                                        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white via-white/90 to-transparent" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works - Simplified */}
            <section id="how-it-works" className="py-20 bg-gray-50 scroll-mt-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <span className="text-orange-600 font-bold tracking-wide uppercase text-sm">How It Works</span>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2 mb-4">From Preference to Plate</h2>
                        <p className="text-gray-600 text-lg max-w-2xl mx-auto">Set your preferences once, get personalized plans every week.</p>
                    </div>

                    {/* Step 1: Preferences - Simplified as Icon Grid */}
                    <div className="bg-white rounded-3xl p-8 md:p-12 border border-gray-100 shadow-lg max-w-4xl mx-auto mb-12">
                        <div className="grid md:grid-cols-2 gap-8 items-center">
                            <div>
                                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-6 text-2xl font-bold text-orange-600">1</div>
                                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Tell Us What You Love</h3>
                                <p className="text-gray-600 text-lg leading-relaxed mb-6">
                                    Set your dietary preferences, cuisine choices, and schedule. QookCommander adapts to your lifestyle.
                                </p>
                                <p className="text-orange-600 font-semibold">
                                    ✨ Custom templates for Indian, Keto, Vegetarian, Family-style & more
                                </p>
                            </div>

                            {/* Icon-based Preferences Display */}
                            <div className="grid grid-cols-2 gap-4">
                                <PreferenceCard icon={<Leaf className="w-6 h-6" />} title="Dietary" examples="Veg, Vegan, Keto" color="green" />
                                <PreferenceCard icon={<Utensils className="w-6 h-6" />} title="Cuisine" examples="Indian, Italian, Asian" color="orange" />
                            </div>
                        </div>
                    </div>

                    {/* Step 2: AI Generation */}
                    <div className="bg-gray-900 rounded-3xl p-8 md:p-12 text-white max-w-4xl mx-auto shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-br from-orange-600/30 to-purple-600/30 rounded-full blur-3xl opacity-40 -translate-y-1/2 translate-x-1/2" />

                        <div className="relative z-10 text-center">
                            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mx-auto mb-6 text-2xl font-bold">2</div>
                            <h3 className="text-2xl md:text-3xl font-bold mb-4">AI Generates Your Plan</h3>
                            <p className="text-gray-300 text-lg max-w-xl mx-auto mb-8">
                                Our AI creates a complete weekly meal plan optimized for your preferences, with minimal ingredient waste.
                            </p>

                            <div className="flex flex-wrap justify-center gap-4">
                                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-orange-400" />
                                    <span className="text-sm">7 Days Planned</span>
                                </div>
                                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
                                    <ChefHat className="w-5 h-5 text-orange-400" />
                                    <span className="text-sm">21+ Meals</span>
                                </div>
                                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
                                    <ShoppingBag className="w-5 h-5 text-orange-400" />
                                    <span className="text-sm">Auto Grocery List</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-20 bg-white scroll-mt-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Everything You Need to Eat Better</h2>
                        <p className="text-gray-600 text-lg">Powerful features designed to simplify your cooking routine.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { icon: Sparkles, title: "AI-Generated Plans", desc: "Get a full week of meals tailored to your diet, allergies, and taste preferences instantly." },
                            { icon: ChefHat, title: "Smart Recipes", desc: "Detailed, easy-to-follow recipes for every meal in your plan." },
                            { icon: CheckCircle2, title: "Auto Grocery List", desc: "Ingredients are automatically aggregated into a sorted shopping checklist." }
                        ].map((feature, i) => (
                            <div key={i} className="bg-gray-50 p-8 rounded-2xl hover:shadow-lg transition-shadow">
                                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-6">
                                    <feature.icon className="w-6 h-6 text-orange-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-gray-50">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="bg-gray-900 rounded-3xl p-10 md:p-16 text-center shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-orange-500 rounded-full blur-[100px] opacity-20 translate-x-1/2 -translate-y-1/2" />
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 relative z-10">Ready to Take Control?</h2>
                        <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto relative z-10">
                            Join home cooks who are saving time and eating better with QookCommander.
                        </p>
                        <button
                            onClick={triggerAuth}
                            className="px-10 py-4 bg-white text-gray-900 font-bold rounded-full hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 relative z-10"
                        >
                            Get Started Now
                        </button>
                    </div>
                </div>
            </section>
        </>
    );
}

// Preference Card Component
function PreferenceCard({ icon, title, examples, color }: { icon: React.ReactNode; title: string; examples: string; color: string }) {
    const colorClasses = {
        green: 'bg-green-50 text-green-600 border-green-100',
        orange: 'bg-orange-50 text-orange-600 border-orange-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
    };

    return (
        <div className={`p-4 rounded-xl border-2 ${colorClasses[color as keyof typeof colorClasses]} transition-transform hover:scale-105`}>
            <div className="mb-2">{icon}</div>
            <h4 className="font-bold text-gray-900 text-sm">{title}</h4>
            <p className="text-gray-500 text-xs">{examples}</p>
        </div>
    );
}
