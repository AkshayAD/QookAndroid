import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Mail, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getOAuthRedirectUrl, isNative } from '../utils/platform';

interface PublicLayoutProps {
    children: React.ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
    const { user, loading: authLoading, signOut } = useAuth();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Listen for auth trigger from child components
    React.useEffect(() => {
        const handleOpenAuth = () => setIsAuthModalOpen(true);
        window.addEventListener('openAuth', handleOpenAuth);
        return () => window.removeEventListener('openAuth', handleOpenAuth);
    }, []);

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

    const openAuth = () => {
        setIsAuthModalOpen(true);
        setError(null);
    };

    const isActiveRoute = (path: string) => location.pathname === path;

    return (
        <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-orange-100 selection:text-orange-900 flex flex-col">
            {/* Navigation */}
            <nav className="fixed w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <Link to="/" className="flex items-center gap-2">
                            <img src={`${import.meta.env.BASE_URL}QookCommander-home-cook-management-app-logo.png`} alt="QookCommander Logo" className="h-10 w-auto" />
                        </Link>

                        <div className="hidden md:flex items-center gap-8">
                            <Link
                                to="/#features"
                                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                Features
                            </Link>
                            <Link
                                to="/#how-it-works"
                                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                How it works
                            </Link>
                            <Link
                                to="/plan"
                                className={`text-sm font-medium transition-colors ${isActiveRoute('/plan') ? 'text-orange-600 font-bold' : 'text-orange-600 hover:text-orange-700'}`}
                            >
                                Pricing
                            </Link>
                            <div className="flex items-center gap-4 ml-4">
                                {user ? (
                                    <>
                                        <span className="text-sm text-gray-500">{user.email}</span>
                                        <Link
                                            to="/dashboard"
                                            className="px-5 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-full hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                                        >
                                            Go to Dashboard
                                        </Link>
                                        <button
                                            onClick={() => signOut()}
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
                        <Link to="/#features" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-medium text-gray-700 py-2">Features</Link>
                        <Link to="/#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-medium text-gray-700 py-2">How it works</Link>
                        <Link to="/plan" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-medium text-orange-600 py-2">Pricing</Link>
                        {user ? (
                            <>
                                <span className="text-sm text-gray-500 py-2">{user.email}</span>
                                <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="btn-primary w-full py-3 bg-gray-900 text-white rounded-lg font-bold text-center">Go to Dashboard</Link>
                                <button onClick={() => { signOut(); setIsMobileMenuOpen(false); }} className="text-left text-base font-medium text-red-600 py-2">Sign Out</button>
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

            {/* Main Content */}
            <main className="flex-grow pt-20">
                {children}
            </main>

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

            {/* Auth Modal */}
            {isAuthModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                        onClick={() => setIsAuthModalOpen(false)}
                    ></div>

                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-scale-in">
                        <div className="p-8">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-gray-900">Welcome to QookCommander</h2>
                                <p className="text-gray-500 text-sm mt-1">Sign in with your Google account to get started</p>
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={handleGoogleAuth}
                                    disabled={loading}
                                    className="w-full py-4 px-4 bg-white border-2 border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                                    )}
                                    {loading ? 'Signing In...' : 'Continue with Google'}
                                </button>

                                {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>}
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
