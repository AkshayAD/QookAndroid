import { useState, useEffect, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getApiBaseUrl } from '../utils/platform';

interface AdminRouteProps {
    children: ReactNode;
}

/**
 * Route guard that only allows access to users in the admin_users table.
 * Redirects non-admins to the dashboard.
 */
export function AdminRoute({ children }: AdminRouteProps) {
    const { user } = useAuth();
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function checkAdminStatus() {
            if (!user) {
                setIsAdmin(false);
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(`${getApiBaseUrl()}/api/admin-api`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'check_admin',
                        userId: user.id
                    })
                });

                const data = await response.json();
                setIsAdmin(data.success && data.data?.isAdmin);
            } catch (error) {
                console.error('Admin check failed:', error);
                setIsAdmin(false);
            } finally {
                setLoading(false);
            }
        }

        checkAdminStatus();
    }, [user]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
            </div>
        );
    }

    if (!user || !isAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
}

/**
 * Hook to check if current user is an admin.
 * Use this to conditionally show admin links in the UI.
 */
export function useIsAdmin() {
    const { user } = useAuth();
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function checkAdminStatus() {
            if (!user) {
                setIsAdmin(false);
                setLoading(false);
                return;
            }

            try {
                const response = await fetch('/api/admin-api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'check_admin',
                        userId: user.id
                    })
                });

                const data = await response.json();
                setIsAdmin(data.success && data.data?.isAdmin);
            } catch (error) {
                setIsAdmin(false);
            } finally {
                setLoading(false);
            }
        }

        checkAdminStatus();
    }, [user]);

    return { isAdmin, loading };
}

export default AdminRoute;
