import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { AdminRoute } from './components/AdminRoute';
import { hideNativeSplashScreen, isNative } from './utils/platform';

const App = lazy(() => import('./App'));
const AppShell = lazy(() => import('./components/AppShell'));
const AuthPage = lazy(() => import('./components/AuthPage'));
const LandingContent = lazy(() => import('./components/LandingContent'));
const PricingContent = lazy(() => import('./components/PricingContent'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const NativeAuthPage = lazy(() => import('./pages/NativeAuthPage'));
const JoinFamilyPage = lazy(() => import('./pages/JoinFamilyPage'));

function RouteLoader({ message = 'Loading...' }: { message?: string }) {
    return (
        <div className="app-safe-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-600">{message}</p>
            </div>
        </div>
    );
}

// Component to capture referral code from URL
function ReferralCapture({ children }: { children: React.ReactNode }) {
    const location = useLocation();

    useEffect(() => {
        // Capture referral code from URL on app load
        const params = new URLSearchParams(window.location.search);
        const refCode = params.get('ref');

        if (refCode) {
            // Store referral code in localStorage for later use during signup
            localStorage.setItem('pendingReferralCode', refCode.toUpperCase());
            console.log('Referral code captured:', refCode.toUpperCase());

            // Clean the URL to remove the ref parameter (optional, for cleaner UX)
            params.delete('ref');
            const cleanQuery = params.toString();
            const cleanUrl = window.location.pathname + (cleanQuery ? `?${cleanQuery}` : '') + window.location.hash;
            window.history.replaceState({}, '', cleanUrl);
        }
    }, [location.pathname, location.search, location.hash]);

    return <>{children}</>;
}
// Protected Route wrapper - redirects to landing if not logged in
function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="app-safe-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}

// Public Route wrapper - redirects to dashboard if already logged in
function PublicRoute({ children, redirectIfAuth = true }: { children: React.ReactNode; redirectIfAuth?: boolean }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="app-safe-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    // Redirect logged-in users to dashboard (for landing page)
    if (redirectIfAuth && user) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
}

// Main Router Component
export default function AppRouter() {
    const useNativeAuthLanding = isNative();
    const { loading } = useAuth();

    useEffect(() => {
        if (!useNativeAuthLanding || loading) {
            return;
        }

        let secondFrame = 0;
        const firstFrame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(() => {
                void hideNativeSplashScreen();
            });
        });

        return () => {
            window.cancelAnimationFrame(firstFrame);
            if (secondFrame) {
                window.cancelAnimationFrame(secondFrame);
            }
        };
    }, [loading, useNativeAuthLanding]);

    return (
        <BrowserRouter>
            <ReferralCapture>
                <Routes>
                    {/* Public Routes - Landing redirects to dashboard if logged in */}
                    <Route path="/" element={
                        <PublicRoute>
                            {useNativeAuthLanding ? (
                                <Suspense fallback={<RouteLoader />}>
                                    <AuthPage />
                                </Suspense>
                            ) : (
                                <Suspense fallback={<RouteLoader />}>
                                    <AppShell mode="public">
                                        <LandingContent />
                                    </AppShell>
                                </Suspense>
                            )}
                        </PublicRoute>
                    } />
                    <Route path="/login" element={
                        <PublicRoute>
                            <Suspense fallback={<RouteLoader />}>
                                <AuthPage />
                            </Suspense>
                        </PublicRoute>
                    } />
                    {/* Pricing page - accessible to all (no redirect) */}
                    <Route path="/plan" element={
                        <Suspense fallback={<RouteLoader />}>
                            <AppShell mode="public">
                                <PricingContent />
                            </AppShell>
                        </Suspense>
                    } />
                    <Route path="/pricing" element={<Navigate to="/plan" replace />} />
                    <Route path="/auth/callback" element={
                        <Suspense fallback={<RouteLoader message="Signing you in..." />}>
                            <AuthCallbackPage />
                        </Suspense>
                    } />
                    <Route path="/auth/native" element={
                        <PublicRoute redirectIfAuth={false}>
                            <Suspense fallback={<RouteLoader message="Opening Google sign-in..." />}>
                                <NativeAuthPage />
                            </Suspense>
                        </PublicRoute>
                    } />

                    {/* Protected Routes - Dashboard uses AppShell (dashboard mode) */}
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute>
                                <Suspense fallback={<RouteLoader />}>
                                    <AppShell mode="dashboard">
                                        <App />
                                    </AppShell>
                                </Suspense>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/*"
                        element={
                            <ProtectedRoute>
                                <Suspense fallback={<RouteLoader />}>
                                    <AppShell mode="dashboard">
                                        <App />
                                    </AppShell>
                                </Suspense>
                            </ProtectedRoute>
                        }
                    />

                    {/* Admin Route - Protected by AdminRoute guard */}
                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute>
                                <AdminRoute>
                                    <Suspense fallback={<RouteLoader />}>
                                        <AdminDashboard />
                                    </Suspense>
                                </AdminRoute>
                            </ProtectedRoute>
                        }
                    />

                    {/* Testing Route - Spotlight tour on real dashboard */}
                    <Route
                        path="/testing"
                        element={
                            <ProtectedRoute>
                                <Suspense fallback={<RouteLoader />}>
                                    <AppShell mode="dashboard">
                                        <App forceOnboarding={true} />
                                    </AppShell>
                                </Suspense>
                            </ProtectedRoute>
                        }
                    />

                    {/* Demo Route - Pre-loaded demo data, no auth required */}
                    <Route
                        path="/demo"
                        element={
                            <Suspense fallback={<RouteLoader />}>
                                <AppShell mode="dashboard">
                                    <App demoMode={true} forceOnboarding={true} />
                                </AppShell>
                            </Suspense>
                        }
                    />

                    {/* Family Invite Link Route */}
                    <Route path="/join-family" element={
                        <Suspense fallback={<RouteLoader />}>
                            <JoinFamilyPage />
                        </Suspense>
                    } />

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </ReferralCapture>
        </BrowserRouter>
    );
}
