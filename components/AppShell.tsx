import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Mail, Loader2, ChefHat, ShoppingCart, RefreshCw, Home, CreditCard, LogOut, User, Sparkles, Shield, Settings, Users } from 'lucide-react';
import { useIsAdmin } from './AdminRoute';
import SettingsModal from './SettingsModal';
import FamilyModeModal from './FamilyModeModal';
import FamilyModeToggle from './FamilyModeToggle';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { getOAuthRedirectUrl, isNative } from '../utils/platform';

interface AppShellProps {
    children: React.ReactNode;
    mode?: 'public' | 'dashboard';
}

export default function AppShell({ children, mode = 'public' }: AppShellProps) {
    const { user, loading: authLoading, signOut } = useAuth();
    const { credits, subscription } = useSubscription();
    const { isAdmin } = useIsAdmin();
    const location = useLocation();
    const navigate = useNavigate();

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isFamilyModeOpen, setIsFamilyModeOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Listen for auth trigger from child components
    useEffect(() => {
        const handleOpenAuth = () => setIsAuthModalOpen(true);
        window.addEventListener('openAuth', handleOpenAuth);
        return () => window.removeEventListener('openAuth', handleOpenAuth);
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    const handleGoogleAuth = async () => {
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase!.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    // Use platform-aware redirect
                    redirectTo: isNative() ? getOAuthRedirectUrl() : window.location.origin + '/dashboard',
                },
            });
            if (error) throw error;
        } catch (err: any) {
            setError(err.message || 'An error occurred');
            setLoading(false);
        }
    };

    const isActiveRoute = (path: string) => location.pathname === path;

    const allNavLinks = [
        { href: '#features', label: 'Features', isAnchor: true, showOnlyPublic: true },
        { href: '#how-it-works', label: 'How it Works', isAnchor: true, showOnlyPublic: true },
        { href: '/plan', label: 'Pricing', highlight: true, showOnlyPublic: true },
    ];

    // Filter out marketing links when on dashboard
    const navLinks = allNavLinks.filter(link => !link.showOnlyPublic || mode === 'public');

    const totalCredits = credits ? (credits.total_meal_credits || 0) : 0;

    // Get subscription plan badge styling
    const getPlanBadge = () => {
        // Use credits.plan_tier as it's more reliable (comes from aggregated credits data)
        // Fall back to subscription.plan_id, then default to 'free'
        let planId = credits?.plan_tier || subscription?.plan_id || 'free';

        // Normalize to lowercase for matching
        planId = planId.toLowerCase();

        // Only show BYOK badge for users on the BYOK plan specifically
        // (not Pro/Basic users who just have byok_enabled from having an API key)

        const badges: Record<string, { label: string; color: string }> = {
            free: { label: 'Free', color: 'bg-gray-100 text-gray-600' },
            basic: { label: 'Basic', color: 'bg-blue-100 text-blue-700' },
            pro: { label: 'Pro', color: 'bg-purple-100 text-purple-700' },
            byok: { label: 'BYOK', color: 'bg-green-100 text-green-700' },
        };
        return badges[planId] || badges.free;
    };

    return (
        <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col">
            {/* Launch Offer Banner - Fixed Marquee clickable */}
            {!user && (
                <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="fixed top-0 left-0 right-0 z-[60] w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-2 px-4 text-sm font-medium overflow-hidden hover:from-green-600 hover:to-emerald-600 transition-all cursor-pointer safe-area-inset-top"
                >
                    <div className="animate-marquee whitespace-nowrap">
                        🚀 LAUNCH OFFER: Get Basic Plan FREE for your first month! Click to Start Free → &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 🚀 LAUNCH OFFER: Get Basic Plan FREE for your first month! Click to Start Free →
                    </div>
                </button>
            )}

            {/* Unified Navigation Header */}
            <nav
                className={`fixed w-full bg-white/95 backdrop-blur-md z-50 border-b border-gray-100 shadow-sm ${user ? 'safe-area-inset-top' : ''}`}
                style={{ top: user ? 0 : 'calc(36px + env(safe-area-inset-top))' }}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo */}
                        <a href="https://qook.in" className="flex items-center gap-2 shrink-0">
                            <img
                                src={`${import.meta.env.BASE_URL}QookCommander-home-cook-management-app-logo.png`}
                                alt="QookCommander"
                                className="h-8 w-auto"
                            />
                        </a>

                        {/* Family/Personal Toggle - Desktop (shown in header bar when logged in) */}
                        {user && mode === 'dashboard' && (
                            <>
                                <div className="hidden md:block h-6 w-px bg-gray-200 mx-2" />
                                <div className="hidden md:block">
                                    <FamilyModeToggle compact />
                                </div>
                            </>
                        )}

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center gap-6">
                            {navLinks.map((link) => (
                                link.isAnchor ? (
                                    <a
                                        key={link.href}
                                        href={link.href}
                                        onClick={(e) => {
                                            const sectionId = link.href.replace('#', '');
                                            const element = document.getElementById(sectionId);
                                            if (element) {
                                                e.preventDefault();
                                                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            } else if (location.pathname !== '/') {
                                                // Navigate to home first, then scroll
                                                navigate('/' + link.href);
                                            }
                                        }}
                                        className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                                    >
                                        {link.label}
                                    </a>
                                ) : (
                                    <Link
                                        key={link.href}
                                        to={link.href}
                                        className={`text-sm font-medium transition-colors ${link.highlight
                                            ? 'text-orange-600 hover:text-orange-700'
                                            : 'text-gray-600 hover:text-gray-900'
                                            } ${isActiveRoute(link.href) ? 'font-bold' : ''}`}
                                    >
                                        {link.label}
                                    </Link>
                                )
                            ))}

                            {/* Separator */}
                            <div className="h-6 w-px bg-gray-200" />

                            {/* Auth Section */}
                            {user ? (
                                <div className="flex items-center gap-4">
                                    {/* Credits Badge */}
                                    <div className="flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full text-sm font-semibold">
                                        <Sparkles className="w-4 h-4" />
                                        <span>{totalCredits} credits</span>
                                    </div>

                                    {/* Dashboard / Home Toggle */}
                                    {mode === 'public' ? (
                                        <Link
                                            to="/dashboard"
                                            className="px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-full hover:bg-gray-800 transition-all"
                                        >
                                            Dashboard
                                        </Link>
                                    ) : (
                                        <Link
                                            to="/"
                                            className="px-4 py-2 text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors flex items-center gap-1"
                                        >
                                            <Home className="w-4 h-4" />
                                            Home
                                        </Link>
                                    )}

                                    {/* User Menu */}
                                    <div className="relative group">
                                        <button className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getPlanBadge().color}`}>
                                                {getPlanBadge().label}
                                            </span>
                                            {/* Hide avatar in dashboard mode - show on home/public only */}
                                            {mode !== 'dashboard' && (
                                                <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                                    {user.email?.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </button>
                                        {/* Dropdown */}
                                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                                            <div className="px-4 py-2 border-b border-gray-100">
                                                <p className="text-xs text-gray-500">Signed in as</p>
                                                <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                                            </div>
                                            <Link to="/plan" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                                <CreditCard className="w-4 h-4" />
                                                Manage Plan
                                            </Link>
                                            <button
                                                onClick={() => setIsFamilyModeOpen(true)}
                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50"
                                            >
                                                <Users className="w-4 h-4" />
                                                Family Mode
                                            </button>
                                            <button
                                                onClick={() => setIsSettingsModalOpen(true)}
                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                            >
                                                <Settings className="w-4 h-4" />
                                                Settings
                                            </button>
                                            {isAdmin && (
                                                <Link to="/admin" className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50">
                                                    <Shield className="w-4 h-4" />
                                                    Admin Dashboard
                                                </Link>
                                            )}
                                            <button
                                                onClick={() => signOut()}
                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                Sign Out
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setIsAuthModalOpen(true)}
                                        className="text-sm font-semibold text-gray-900 hover:text-orange-600 transition-colors"
                                    >
                                        Log in
                                    </button>
                                    <button
                                        onClick={() => setIsAuthModalOpen(true)}
                                        className="px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-full hover:bg-gray-800 transition-all"
                                    >
                                        Get Started
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Mobile User Controls (no hamburger menu) */}
                        <div className="md:hidden flex items-center gap-2">
                            {user ? (
                                <>
                                    {/* Family/Personal Toggle - Mobile */}
                                    {mode === 'dashboard' && (
                                        <FamilyModeToggle compact />
                                    )}
                                    {/* Mobile Credits Badge */}
                                    <div className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded-full text-xs font-semibold">
                                        <Sparkles className="w-3 h-3" />
                                        <span>{totalCredits}</span>
                                    </div>
                                    {/* Plan Badge + Avatar - links to dashboard */}
                                    <Link to="/dashboard" className="flex items-center gap-1.5">
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getPlanBadge().color}`}>
                                            {getPlanBadge().label}
                                        </span>
                                        {/* Hide avatar in dashboard mode - show on home/public only */}
                                        {mode !== 'dashboard' && (
                                            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                                {user.email?.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </Link>
                                </>
                            ) : (
                                <button
                                    onClick={() => setIsAuthModalOpen(true)}
                                    className="px-3 py-1.5 bg-orange-600 text-white text-xs font-bold rounded-full"
                                >
                                    Get Started
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className={`flex-grow ${user ? 'pt-[calc(4rem+env(safe-area-inset-top))]' : 'pt-[calc(100px+env(safe-area-inset-top))]'}`}>
                {children}
            </main>

            {/* Footer (only on public pages) */}
            {mode === 'public' && (
                <footer className="bg-gray-50 py-12 border-t border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex flex-col items-center md:items-start gap-4">
                            <img src={`${import.meta.env.BASE_URL}QookCommander-home-cook-management-app-logo.png`} alt="QookCommander" className="h-8 w-auto" />
                            <div className="text-sm text-gray-500 text-center md:text-left">
                                <p>© {new Date().getFullYear()} QookCommander. All rights reserved.</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-center md:items-end gap-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-orange-500" />
                                <a href="mailto:akshaydewalwar1@gmail.com" className="hover:text-orange-600">akshaydewalwar1@gmail.com</a>
                            </div>
                        </div>
                    </div>
                </footer>
            )}

            {/* Auth Modal */}
            {isAuthModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                        onClick={() => setIsAuthModalOpen(false)}
                    />
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden">
                        <div className="p-8">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-gray-900">Welcome to QookCommander</h2>
                                <p className="text-gray-500 text-sm mt-1">Sign in to continue</p>
                            </div>
                            <button
                                onClick={handleGoogleAuth}
                                disabled={loading}
                                className="w-full py-4 px-4 bg-white border-2 border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-3"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                                )}
                                {loading ? 'Signing In...' : 'Continue with Google'}
                            </button>
                            {error && <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* CSS for mobile drawer animation */}
            <style>{`
                @keyframes slide-in-right {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.3s ease-out;
                }
                @keyframes marquee {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    display: inline-block;
                    animation: marquee 15s linear infinite;
                }
            `}</style>

            {/* Settings Modal */}
            {isSettingsModalOpen && (
                <SettingsModal
                    onClose={() => setIsSettingsModalOpen(false)}
                    canClose={true}
                />
            )}

            {/* Family Mode Modal */}
            {isFamilyModeOpen && (
                <FamilyModeModal
                    onClose={() => setIsFamilyModeOpen(false)}
                />
            )}
        </div>
    );
}
