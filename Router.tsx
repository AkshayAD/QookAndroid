import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import App from './App';
import AppShell from './components/AppShell';
import LandingContent from './components/LandingContent';
import PricingContent from './components/PricingContent';
import AdminDashboard from './pages/AdminDashboard';
import Onboarding from './pages/Onboarding';
import JoinFamilyPage from './pages/JoinFamilyPage';
import { AdminRoute } from './components/AdminRoute';

// Component to capture referral code from URL
function ReferralCapture({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Capture referral code from URL on app load
        const params = new URLSearchParams(window.location.search);
        const refCode = params.get('ref');

        if (refCode) {
            // Store referral code in localStorage for later use during signup
            localStorage.setItem('pendingReferralCode', refCode.toUpperCase());
            console.log('Referral code captured:', refCode.toUpperCase());

            // Clean the URL to remove the ref parameter (optional, for cleaner UX)
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, '', cleanUrl);
        }
    }, []);

    return <>{children}</>;
}
// Protected Route wrapper - redirects to landing if not logged in
function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
    return (
        <BrowserRouter>
            <ReferralCapture>
                <Routes>
                    {/* Public Routes - Landing redirects to dashboard if logged in */}
                    <Route path="/" element={
                        <PublicRoute>
                            <AppShell mode="public">
                                <LandingContent />
                            </AppShell>
                        </PublicRoute>
                    } />
                    {/* Pricing page - accessible to all (no redirect) */}
                    <Route path="/plan" element={
                        <AppShell mode="public">
                            <PricingContent />
                        </AppShell>
                    } />
                    <Route path="/pricing" element={<Navigate to="/plan" replace />} />

                    {/* Protected Routes - Dashboard uses AppShell (dashboard mode) */}
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute>
                                <AppShell mode="dashboard">
                                    <App />
                                </AppShell>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/*"
                        element={
                            <ProtectedRoute>
                                <AppShell mode="dashboard">
                                    <App />
                                </AppShell>
                            </ProtectedRoute>
                        }
                    />

                    {/* Admin Route - Protected by AdminRoute guard */}
                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute>
                                <AdminRoute>
                                    <AdminDashboard />
                                </AdminRoute>
                            </ProtectedRoute>
                        }
                    />

                    {/* Testing Route - Spotlight tour on real dashboard */}
                    <Route
                        path="/testing"
                        element={
                            <ProtectedRoute>
                                <AppShell mode="dashboard">
                                    <App forceOnboarding={true} />
                                </AppShell>
                            </ProtectedRoute>
                        }
                    />

                    {/* Demo Route - Pre-loaded demo data, no auth required */}
                    <Route
                        path="/demo"
                        element={
                            <AppShell mode="dashboard">
                                <App demoMode={true} forceOnboarding={true} />
                            </AppShell>
                        }
                    />

                    {/* Family Invite Link Route */}
                    <Route path="/join-family" element={<JoinFamilyPage />} />

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </ReferralCapture>
        </BrowserRouter>
    );
}
