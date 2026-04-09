import React, { useState, useEffect } from 'react';
import { ChefHat, ArrowRight, CheckCircle2, Star, Sparkles, AlertTriangle, Menu, X, Mail } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';
import GoogleSignInButton from './GoogleSignInButton';

interface LandingPageProps {
    isLoggedIn?: boolean;
    userEmail?: string;
    onGoToDashboard?: () => void;
    onSignOut?: () => Promise<void> | void;
}

const LandingPage: React.FC<LandingPageProps> = ({
    isLoggedIn = false,
    userEmail,
    onGoToDashboard,
    onSignOut
}) => {
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Capture referral code from URL on page load
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');

        if (refCode && refCode.match(/^QOOK-[A-Z0-9]{6}$/i)) {
            // Store the referral code in localStorage for use after signup
            localStorage.setItem('pendingReferralCode', refCode.toUpperCase());
            console.log('Referral code captured:', refCode.toUpperCase());

            // Clean the URL (optional - removes the ?ref= param)
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        }
    }, []);

    const openAuth = () => {
        setIsAuthModalOpen(true);
        setError(null);
    };

    // Config Check
    if (!isSupabaseConfigured) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Setup Required</h1>
                    <p className="text-gray-600 mb-6">Supabase credentials missing. Please configure .env</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-orange-100 selection:text-orange-900">

            {/* Navigation */}
            <nav className="fixed w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center gap-2">
                            <img src={`${import.meta.env.BASE_URL}QookCommander-home-cook-management-app-logo.png`} alt="QookCommander Logo" className="h-10 w-auto" />
                        </div>

                        <div className="hidden md:flex items-center gap-8">
                            <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Features</a>
                            <a href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">How it works</a>
                            <a href="/plan" className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors">Pricing</a>
                            <div className="flex items-center gap-4 ml-4">
                                {isLoggedIn ? (
                                    <>
                                        <span className="text-sm text-gray-500">{userEmail}</span>
                                        <button
                                            onClick={onGoToDashboard}
                                            className="px-5 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-full hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                                        >
                                            Go to Dashboard
                                        </button>
                                        <button
                                            onClick={onSignOut}
                                            className="text-sm font-semibold text-gray-600 hover:text-red-600 transition-colors"
                                        >
                                            Sign Out
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={openAuth}
                                            className="text-sm font-semibold text-gray-900 hover:text-orange-600 transition-colors"
                                        >
                                            Log in
                                        </button>
                                        <button
                                            onClick={openAuth}
                                            className="px-5 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-full hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                                        >
                                            Get Started
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="md:hidden">
                            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-600">
                                {isMobileMenuOpen ? <X /> : <Menu />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden bg-white border-t border-gray-100 py-4 px-4 flex flex-col gap-4 shadow-xl">
                        <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-medium text-gray-700 py-2">Features</a>
                        <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-medium text-gray-700 py-2">How it works</a>
                        {isLoggedIn ? (
                            <>
                                <span className="text-sm text-gray-500 py-2">{userEmail}</span>
                                <button onClick={() => { onGoToDashboard?.(); setIsMobileMenuOpen(false); }} className="btn-primary w-full py-3 bg-gray-900 text-white rounded-lg font-bold">Go to Dashboard</button>
                                <button onClick={() => { onSignOut?.(); setIsMobileMenuOpen(false); }} className="text-left text-base font-medium text-red-600 py-2">Sign Out</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => { openAuth(); setIsMobileMenuOpen(false); }} className="text-left text-base font-medium text-gray-700 py-2">Log in</button>
                                <button onClick={() => { openAuth(); setIsMobileMenuOpen(false); }} className="btn-primary w-full py-3 bg-orange-600 text-white rounded-lg font-bold">Get Started</button>
                            </>
                        )}
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-orange-200/30 rounded-full blur-3xl -z-10 opacity-50 pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-100 text-orange-700 text-xs font-bold uppercase tracking-wide mb-8 animate-fade-in-up">
                        <Sparkles className="w-3 h-3" />
                        <span>AI-Powered Kitchen Assistant</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-8 leading-[1.1]">
                        Master Your Kitchen <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-red-600">Without the Chaos</span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-xl text-gray-600 mb-10 leading-relaxed">
                        Stop worrying about "what's for dinner". QookCommander generates personalized weekly meal plans and organized grocery lists in seconds. The ultimate AI home cook management tool.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        {isLoggedIn ? (
                            <button
                                onClick={onGoToDashboard}
                                className="w-full sm:w-auto px-8 py-4 bg-gray-900 text-white font-bold rounded-full hover:bg-gray-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-2 group"
                            >
                                Go to Dashboard
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={openAuth}
                                    className="w-full sm:w-auto px-8 py-4 bg-gray-900 text-white font-bold rounded-full hover:bg-gray-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-2 group"
                                >
                                    Start Planning Free
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </>
                        )}
                    </div>

                    {/* Social Proof / Stats */}
                    <div className="mt-16 flex flex-wrap justify-center gap-8 md:gap-16 opacity-80">
                        {['100% Personalized', 'Saves 2+ Hours/Week', 'Zero Food Waste'].map((stat, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                <span className="font-semibold text-gray-700">{stat}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* How It Works - Visual Flow Section */}
                <div id="how-it-works" className="mt-32 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
                    <div className="relative">
                        <div className="text-center mb-16">
                            <span className="text-orange-600 font-bold tracking-wide uppercase text-sm">See It In Action</span>
                            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mt-2 mb-4">From Preference to Plate</h2>
                            <p className="text-gray-600 text-lg max-w-2xl mx-auto">Experience the seamless flow of QookCommander. Set your tastes, get your plan, and shop with ease.</p>
                        </div>

                        {/* Step 1: Preferences */}
                        <div className="relative mb-24 last:mb-0 group">
                            <div className="bg-gray-50 rounded-3xl p-8 md:p-12 border border-gray-100 overflow-hidden relative">
                                <div className="grid md:grid-cols-2 gap-12 items-center">
                                    <div>
                                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6 text-2xl font-bold text-orange-600">1</div>
                                        <h3 className="text-3xl font-bold text-gray-900 mb-4">Tell Us What You Love</h3>
                                        <p className="text-gray-600 text-lg leading-relaxed">
                                            Vegetarian? Keto? Love spicy food? Just set your preferences once.
                                            QookCommander supports diverse dietary needs including detailed regional Indian cuisine preferences.
                                        </p>
                                    </div>
                                    <div className="relative perspective-1000">
                                        <div className="relative z-10 rounded-xl overflow-hidden shadow-2xl border-4 border-white transform transition-transform group-hover:scale-[1.02] duration-500">
                                            <img src={`${import.meta.env.BASE_URL}Preferences.png`} alt="Preferences Setup" className="w-full h-auto" />
                                        </div>
                                        {/* Decorative elements */}
                                        <div className="absolute -inset-4 bg-orange-100 rounded-full blur-2xl opacity-40 -z-10"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Step 2: The Generated Plan (Primary) */}
                        <div className="relative mb-24 last:mb-0">
                            <div className="bg-gray-900 rounded-3xl p-8 md:p-12 text-white overflow-hidden relative shadow-2xl">
                                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-orange-600/30 to-purple-600/30 rounded-full blur-3xl opacity-40 -translate-y-1/2 translate-x-1/2"></div>

                                <div className="text-center max-w-3xl mx-auto mb-16 relative z-10">
                                    <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-white">2</div>
                                    <h3 className="text-3xl md:text-4xl font-bold mb-4">Your Perfect Weekly Plan</h3>
                                    <p className="text-gray-300 text-lg">AI-crafted menus that optimize ingredients and minimize waste. Available in English and Hindi.</p>
                                </div>

                                <div className="relative h-[400px] md:h-[600px] w-full flex justify-center items-start perspective-1000">
                                    {/* English Plan (Left/Back) */}
                                    <div className="absolute w-[80%] md:w-[60%] left-0 md:left-10 top-10 transform -rotate-6 opacity-70 scale-95 origin-bottom-right transition-all duration-700 hover:opacity-100 hover:z-20 hover:scale-100 hover:rotate-0">
                                        <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-700 bg-gray-800">
                                            <div className="bg-gray-900/50 px-4 py-2 flex justify-between items-center text-xs text-gray-400 border-b border-gray-700">
                                                <span>Hindi Plan</span>
                                            </div>
                                            <img src={`${import.meta.env.BASE_URL}qook-app-weekly-meal-planner.png`} alt="Hindi Meal Plan" className="w-full h-auto blur-[1px] hover:blur-none transition-all" />
                                        </div>
                                    </div>

                                    {/* English Plan (Main/Front) */}
                                    <div className="absolute w-[90%] md:w-[65%] z-10 transform translate-y-0 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 hover:-translate-y-2">
                                        <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-700 bg-gray-900">
                                            <div className="bg-gray-800 px-4 py-2 flex items-center gap-2 border-b border-gray-700">
                                                <div className="flex gap-1.5">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                                </div>
                                                <span className="text-xs text-gray-400 font-mono ml-4">weekly_plan_final.qook</span>
                                            </div>
                                            <img src={`${import.meta.env.BASE_URL}qook-app-weekly-meal-planner.png`} alt="English Meal Plan" className="w-full h-auto" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Step 3: Mobile & Grocery & Share */}
                        <div className="grid md:grid-cols-2 gap-8 mb-24">
                            {/* Grocery & Share */}
                            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-lg hover:shadow-xl transition-shadow flex flex-col">
                                <div className="mb-6">
                                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-6 text-2xl font-bold text-green-600">3</div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-3">Shop & Share in Seconds</h3>
                                    <p className="text-gray-600">
                                        Beautiful shareable cards for your weekly menu and grocery list. Send to your cook on WhatsApp with one tap.
                                    </p>
                                </div>
                                <div className="relative flex-grow flex items-center justify-center min-h-[400px] overflow-visible rounded-2xl bg-gradient-to-br from-green-50 via-orange-50 to-amber-50 p-4">
                                    {/* Two cards side by side - Grocery and Menu */}
                                    <div className="flex gap-4 items-start justify-center w-full">
                                        {/* Grocery List Card */}
                                        <div className="w-[45%] transform -rotate-2 hover:rotate-0 transition-transform duration-500 shadow-2xl rounded-lg overflow-hidden border-2 border-white">
                                            <img
                                                src={`${import.meta.env.BASE_URL}qookcommander-grocery-Feb-1---Feb-7,-2026.png`}
                                                className="w-full"
                                                alt="Grocery Shopping List"
                                            />
                                        </div>
                                        {/* Weekly Menu Card */}
                                        <div className="w-[45%] transform rotate-2 hover:rotate-0 transition-transform duration-500 shadow-2xl rounded-lg overflow-hidden border-2 border-white">
                                            <img
                                                src={`${import.meta.env.BASE_URL}Weekly Menu.png`}
                                                className="w-full"
                                                alt="Weekly Menu Plan"
                                            />
                                        </div>
                                    </div>
                                    {/* WhatsApp indicator */}
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                        Share on WhatsApp
                                    </div>
                                </div>
                            </div>

                            {/* Mobile View */}
                            <div className="bg-gray-900 rounded-3xl p-8 text-white shadow-lg overflow-hidden relative flex flex-col">
                                <div className="relative z-10 mb-8">
                                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-6 text-2xl font-bold text-white">4</div>
                                    <h3 className="text-2xl font-bold mb-3">Perfect on Mobile</h3>
                                    <p className="text-gray-400">
                                        Access your plans and lists anywhere. The responsive design works perfectly on your phone.
                                    </p>
                                </div>
                                <div className="flex-grow flex justify-center perspective-1000 relative z-10">
                                    <div className="w-[220px] h-[450px] rounded-[2.5rem] bg-gray-800 border-[6px] border-gray-700 shadow-2xl overflow-hidden relative transform rotate-1 hover:rotate-0 transition-transform duration-500">
                                        <img src={`${import.meta.env.BASE_URL}qook-app-mobile-view.png`} className="w-full h-full object-contain bg-white" alt="Mobile App" />
                                    </div>
                                </div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-500/20 rounded-full blur-3xl -z-0"></div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything you need to eat better</h2>
                        <p className="text-gray-600 text-lg">Powerful features designed to simplify your cooking routine.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { icon: Sparkles, title: "AI-Generated Plans", desc: "Get a full week of meals tailored to your diet, allergies, and taste preferences instantly." },
                            { icon: ChefHat, title: "Smart Recipes", desc: "Detailed, easy-to-follow recipes for every meal in your plan." },
                            { icon: CheckCircle2, title: "Auto Grocery List", desc: "Ingredients are automatically aggregated into a sorted shopping checklist." }
                        ].map((feature, i) => (
                            <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
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
            <section className="py-24 bg-white relative overflow-hidden">
                <div className="max-w-5xl mx-auto px-4 relative z-10 bg-gray-900 rounded-3xl p-12 md:p-20 text-center shadow-2xl overflow-hidden">
                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-500 rounded-full blur-[100px] opacity-20 translate-x-1/2 -translate-y-1/2"></div>
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to take control?</h2>
                    <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">Join thousands of home cooks who are saving time and eating better with QookCommander.</p>

                    <button
                        onClick={openAuth}
                        className="px-10 py-4 bg-white text-gray-900 font-bold rounded-full hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                    >
                        Get Started Now
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-50 py-12 border-t border-gray-200">
                <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col items-center md:items-start gap-4">
                        <div className="flex items-center gap-2">
                            <img src={`${import.meta.env.BASE_URL}QookCommander-home-cook-management-app-logo.png`} alt="QookCommander" className="h-10 w-auto" />
                        </div>
                        <div className="text-sm text-gray-500 space-y-1 text-center md:text-left">
                            <p>© {new Date().getFullYear()} QookCommander. All rights reserved.</p>
                            <p>Owned by <a href="https://qook.in" className="hover:text-orange-600 transition-colors">Qook.in</a></p>
                        </div>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-2 text-sm text-gray-600">
                        <h4 className="font-bold text-gray-900">Contact Us</h4>
                        <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-orange-500" />
                            <a href="mailto:akshaydewalwar1@gmail.com" className="hover:text-orange-600 transition-colors">akshaydewalwar1@gmail.com</a>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-orange-500">PRO</span>
                            <span>+91 8329265013</span>
                        </div>
                    </div>
                </div>
            </footer>

            {/* integrated Auth Modal */}
            {isAuthModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                        onClick={() => setIsAuthModalOpen(false)}
                    ></div>

                    {/* Modal Card */}
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-scale-in">
                        <div className="p-8">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-gray-900">Welcome to Qook</h2>
                                <p className="text-gray-500 text-sm mt-1">Sign in with your Google account to get started</p>
                            </div>

                            <div className="space-y-4">
                                <GoogleSignInButton
                                    onError={(nextError) => setError(nextError)}
                                    showUnavailableMessage={true}
                                />
                                {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>}
                            </div>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
};

export default LandingPage;
