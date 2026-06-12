import { useState, useEffect } from 'react';
import {
    Users,
    CreditCard,
    BarChart3,
    Shield,
    Search,
    Plus,
    Minus,
    RefreshCw,
    Ban,
    CheckCircle,
    ChevronRight,
    X,
    AlertTriangle,
    Download,
    UserPlus,
    Trash2,
    TestTube,
    Key,
    Grid3X3,
    ToggleLeft,
    ToggleRight,
    Bell,
    Send
} from 'lucide-react';
import { FEATURE_DESCRIPTIONS } from '../lib/billing/featureAccess';
import { getAuthenticatedJsonHeaders } from '../utils/authHeaders';
import { getApiBaseUrl } from '../utils/platform';

interface User {
    user_id: string;
    email: string;
    current_tier: string;
    last_active_at: string;
    total_generations: number;
    active_credits: number;
    bonus_credits: number;
}

interface UserDetails {
    user: any;
    subscription: any;
    credits: any[];
    recentUsage: any[];
    transactions: any[];
    mealPlanCount: number;
    mealHistoryCount: number;
    preferenceProfiles: any[];
    auditLog: any[];
    isBlocked: boolean;
    blockedInfo: any;
}

interface Analytics {
    activeUsers7d: number;
    totalUsers: number;
    creditsUsed7d: number;
    totalRevenueINR: number;
    planDistribution: Record<string, number>;
}

interface DetailedAnalytics {
    totalUsers: number;
    activeUsers7d: number;
    activeUsers30d: number;
    generationsByType: Record<string, { count: number; credits: number }>;
    dailyTrend: Record<string, number>;
    planDistribution: Record<string, number>;
    totalRevenueINR: number;
    totalProfiles: number;
    totalMealPlans: number;
}

interface AggregateInsights {
    topDietaryTypes: { type: string; count: number }[];
    topDislikes: { item: string; count: number }[];
    peakHours: { hour: number; count: number }[];
    featureAdoption: Record<string, number>;
    hourlyDistribution: Record<number, number>;
}

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'access' | 'test' | 'analytics' | 'templates' | 'history' | 'features' | 'notifications'>('overview');
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [detailedAnalytics, setDetailedAnalytics] = useState<DetailedAnalytics | null>(null);
    const [insights, setInsights] = useState<AggregateInsights | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Credit modification state
    const [creditModal, setCreditModal] = useState<{
        open: boolean;
        operation: 'add' | 'remove';
        creditType: string;
        sourceType: 'bonus' | 'pack' | 'admin';
        expiresAt: string;
    } | null>(null);
    const [creditAmount, setCreditAmount] = useState(1);

    // Admin and test account state
    const [admins, setAdmins] = useState<any[]>([]);
    const [testAccounts, setTestAccounts] = useState<any[]>([]);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminRole, setNewAdminRole] = useState('admin');

    useEffect(() => {
        loadAnalytics();
        loadAllUsers();
    }, []);

    async function adminAPI(action: string, payload?: any) {
        const response = await fetch(`${getApiBaseUrl()}/api/admin-api`, {
            method: 'POST',
            headers: await getAuthenticatedJsonHeaders(),
            body: JSON.stringify({
                action,
                payload
            })
        });
        return response.json();
    }

    async function loadAnalytics() {
        setLoading(true);
        try {
            const result = await adminAPI('get_analytics');
            if (result.success) {
                setAnalytics(result.data);
            }
        } catch (error) {
            console.error('Failed to load analytics:', error);
        } finally {
            setLoading(false);
        }
    }

    async function loadDetailedAnalytics() {
        try {
            const [analyticsResult, insightsResult] = await Promise.all([
                adminAPI('get_detailed_analytics'),
                adminAPI('get_aggregate_insights')
            ]);
            if (analyticsResult.success) {
                setDetailedAnalytics(analyticsResult.data);
            }
            if (insightsResult.success) {
                setInsights(insightsResult.data);
            }
        } catch (error) {
            console.error('Failed to load detailed analytics:', error);
        }
    }

    async function loadUserActivityTimeline(userId: string) {
        try {
            const result = await adminAPI('get_user_activity_timeline', { targetUserId: userId });
            if (result.success) {
                return result.data;
            }
        } catch (error) {
            console.error('Failed to load user timeline:', error);
        }
        return null;
    }

    async function loadAllUsers() {
        try {
            const result = await adminAPI('list_users', { limit: 100 });
            if (result.success) {
                setAllUsers(result.data.users || []);
                setUsers(result.data.users || []);
            }
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    }

    function searchUsers() {
        if (!searchQuery.trim()) {
            setUsers(allUsers);
            return;
        }
        const filtered = allUsers.filter(u =>
            (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
        setUsers(filtered);
    }

    async function loadUserDetails(userId: string) {
        setActionLoading(true);
        try {
            const result = await adminAPI('get_user_details', { targetUserId: userId });
            if (result.success) {
                setSelectedUser(result.data);
            }
        } catch (error) {
            console.error('Failed to load user details:', error);
        } finally {
            setActionLoading(false);
        }
    }

    async function modifyCredits() {
        if (!selectedUser || !creditModal) return;
        setActionLoading(true);
        try {
            const result = await adminAPI('modify_credits', {
                targetUserId: selectedUser.user.user_id,
                creditType: creditModal.creditType,
                operation: creditModal.operation,
                amount: creditAmount,
                sourceType: creditModal.sourceType,
                expiresAt: creditModal.expiresAt || undefined,
                reason: 'Admin modification'
            });
            if (result.success) {
                setMessage({ type: 'success', text: `Credits ${creditModal.operation === 'add' ? 'added' : 'removed'} successfully` });
                loadUserDetails(selectedUser.user.user_id);
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to modify credits' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to modify credits' });
        } finally {
            setActionLoading(false);
            setCreditModal(null);
            setCreditAmount(1);
        }
    }

    async function resetAccount() {
        if (!selectedUser || !confirm('Are you sure you want to reset this account? This will delete all meal plans, preferences, and reset credits.')) return;
        setActionLoading(true);
        try {
            const result = await adminAPI('reset_account', { targetUserId: selectedUser.user.user_id });
            if (result.success) {
                setMessage({ type: 'success', text: 'Account reset successfully' });
                loadUserDetails(selectedUser.user.user_id);
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to reset account' });
        } finally {
            setActionLoading(false);
        }
    }

    async function toggleBlock() {
        if (!selectedUser) return;
        setActionLoading(true);
        try {
            if (selectedUser.isBlocked) {
                await adminAPI('unblock_user', { targetUserId: selectedUser.user.user_id });
                setMessage({ type: 'success', text: 'User unblocked' });
            } else {
                const reason = prompt('Enter reason for blocking:');
                if (reason === null) {
                    setActionLoading(false);
                    return;
                }
                await adminAPI('block_user', { targetUserId: selectedUser.user.user_id, reason });
                setMessage({ type: 'success', text: 'User blocked' });
            }
            loadUserDetails(selectedUser.user.user_id);
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update block status' });
        } finally {
            setActionLoading(false);
        }
    }

    async function changeTier(newTier: string) {
        if (!selectedUser) return;
        if (!confirm(`Change this user's tier to ${newTier}?`)) return;
        setActionLoading(true);
        try {
            const result = await adminAPI('change_tier', {
                targetUserId: selectedUser.user.user_id,
                newTier
            });
            if (result.success) {
                setMessage({ type: 'success', text: result.data.message || `Tier changed to ${newTier}` });
                loadUserDetails(selectedUser.user.user_id);
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to change tier' });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to change tier' });
        } finally {
            setActionLoading(false);
        }
    }

    async function cancelRazorpay() {
        if (!selectedUser) return;
        if (!confirm('Cancel Razorpay subscription? This will stop auto-deductions.')) return;
        setActionLoading(true);
        try {
            const result = await adminAPI('cancel_razorpay', {
                targetUserId: selectedUser.user.user_id
            });
            if (result.success) {
                setMessage({ type: 'success', text: result.data.message || 'Razorpay cancelled' });
                loadUserDetails(selectedUser.user.user_id);
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to cancel Razorpay' });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to cancel Razorpay' });
        } finally {
            setActionLoading(false);
        }
    }

    async function deleteUser() {
        if (!selectedUser) return;
        if (!confirm('PERMANENTLY DELETE this user? This action cannot be undone!')) return;
        if (!confirm('Are you REALLY sure? All user data will be lost forever.')) return;
        setActionLoading(true);
        try {
            const result = await adminAPI('delete_user', {
                targetUserId: selectedUser.user.user_id
            });
            if (result.success) {
                setMessage({ type: 'success', text: 'User deleted successfully' });
                setSelectedUser(null);
                loadAllUsers();
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to delete user' });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to delete user' });
        } finally {
            setActionLoading(false);
        }
    }

    // Load admins and test accounts
    async function loadAdmins() {
        const result = await adminAPI('list_admins');
        if (result.success) setAdmins(result.data.admins || []);
    }

    async function loadTestAccounts() {
        const result = await adminAPI('list_test_accounts');
        if (result.success) setTestAccounts(result.data.accounts || []);
    }

    async function addAdmin() {
        if (!newAdminEmail.trim()) return;
        setActionLoading(true);
        try {
            const result = await adminAPI('add_admin', { email: newAdminEmail, role: newAdminRole });
            if (result.success) {
                setMessage({ type: 'success', text: 'Admin added' });
                setNewAdminEmail('');
                loadAdmins();
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to add admin' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to add admin' });
        } finally {
            setActionLoading(false);
        }
    }

    async function removeAdmin(email: string) {
        if (!confirm(`Remove admin access for ${email}?`)) return;
        const result = await adminAPI('remove_admin', { email });
        if (result.success) {
            setMessage({ type: 'success', text: 'Admin removed' });
            loadAdmins();
        }
    }

    async function createTestUser(email: string, tier: string) {
        setActionLoading(true);
        try {
            const result = await adminAPI('create_test_user', { email, tier });
            if (result.success) {
                setMessage({ type: 'success', text: result.data.message || 'Test user created' });
                loadTestAccounts();
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to create test user' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to create test user' });
        } finally {
            setActionLoading(false);
        }
    }

    async function resetTestUser(email: string, tier: string) {
        if (!confirm(`Reset QA account ${email} to a fresh onboarding state?`)) return;
        setActionLoading(true);
        try {
            const result = await adminAPI('reset_test_user', { email, tier });
            if (result.success) {
                const counts = result.data?.counts || {};
                const clearedTables = Object.entries(counts)
                    .filter(([, value]) => Number(value) > 0)
                    .map(([key, value]) => `${key}: ${value}`)
                    .slice(0, 6)
                    .join(', ');

                setMessage({
                    type: 'success',
                    text: clearedTables
                        ? `${result.data.message || 'QA account reset'} (${clearedTables})`
                        : (result.data.message || 'QA account reset')
                });
                loadTestAccounts();
            }
            else {
                setMessage({ type: 'error', text: result.error || 'Failed to reset QA account' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to reset QA account' });
        } finally {
            setActionLoading(false);
        }
    }

    // Inline components
    function AccessControlTab() {
        useEffect(() => { loadAdmins(); }, []);

        return (
            <div className="space-y-6">
                <h2 className="text-xl font-semibold">Access Control</h2>

                {/* Add New Admin */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-medium mb-4">Add New Admin</h3>
                    <div className="flex gap-2">
                        <input
                            type="email"
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            placeholder="Email address"
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg"
                        />
                        <select
                            value={newAdminRole}
                            onChange={(e) => setNewAdminRole(e.target.value)}
                            className="px-4 py-2 border border-gray-200 rounded-lg"
                        >
                            <option value="admin">Admin</option>
                            <option value="super_admin">Super Admin</option>
                        </select>
                        <button
                            onClick={addAdmin}
                            disabled={actionLoading}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                        >
                            <UserPlus className="w-4 h-4" /> Add
                        </button>
                    </div>
                </div>

                {/* Admin List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Email</th>
                                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Role</th>
                                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Added</th>
                                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {admins.map((admin: any) => (
                                <tr key={admin.id}>
                                    <td className="px-6 py-4 text-sm">{admin.email}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${admin.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {admin.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {new Date(admin.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => removeAdmin(admin.email)}
                                            className="text-red-600 hover:text-red-700 flex items-center gap-1 text-sm"
                                        >
                                            <Trash2 className="w-4 h-4" /> Remove
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    function TestAccountsTab() {
        useEffect(() => { loadTestAccounts(); }, []);

        return (
            <div className="space-y-6">
                <h2 className="text-xl font-semibold">Test Accounts</h2>
                <p className="text-gray-500">Reusable QA accounts for onboarding and billing checks. Manual-reset accounts should be created by signing in with Google once, then reset from here before the next test run.</p>

                {/* Test Account Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {testAccounts.map((acc: any) => (
                        <div key={acc.id} className={`p-6 rounded-xl shadow-sm border ${acc.tier === 'pro' ? 'bg-purple-50 border-purple-200' :
                            acc.tier === 'basic' ? 'bg-blue-50 border-blue-200' :
                                'bg-gray-50 border-gray-200'
                            }`}>
                            <div className="flex items-center gap-2 mb-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${acc.tier === 'pro' ? 'bg-purple-500 text-white' :
                                    acc.tier === 'basic' ? 'bg-blue-500 text-white' :
                                        'bg-gray-500 text-white'
                                    }`}>
                                    {acc.tier}
                                </span>
                                {acc.exists ? (
                                    <span className="text-green-600 text-xs flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> Active
                                    </span>
                                ) : (
                                    <span className="text-gray-400 text-xs">Not Created</span>
                                )}
                            </div>
                            <p className="text-sm font-medium mb-1">{acc.email}</p>
                            <p className="text-xs text-gray-500 mb-4">{acc.description}</p>
                            {acc.reset_mode === 'manual' && (
                                <p className="text-[11px] text-amber-700 mb-3">
                                    Google OAuth QA account. Login once with Google to create the auth user, then use reset before each onboarding test.
                                </p>
                            )}
                            <div className="flex gap-2">
                                {!acc.exists && acc.canCreate ? (
                                    <button
                                        onClick={() => createTestUser(acc.email, acc.tier)}
                                        disabled={actionLoading}
                                        className="flex-1 px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
                                    >
                                        Create Account
                                    </button>
                                ) : !acc.exists ? (
                                    <div className="flex-1 px-3 py-2 bg-gray-100 text-gray-600 text-xs rounded-lg text-center">
                                        Login Once With Google
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => resetTestUser(acc.email, acc.tier)}
                                        disabled={actionLoading}
                                        className="flex-1 px-3 py-2 bg-orange-600 text-white text-xs rounded-lg hover:bg-orange-700 flex items-center justify-center gap-1"
                                    >
                                        <RefreshCw className="w-3 h-3" /> {acc.reset_mode === 'manual' ? 'Reset QA Account' : 'Reset'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-amber-800 text-sm">
                        <strong>Note:</strong> `ardhsayar@gmail.com` is intended to stay as a real Google account. Reset clears app-owned state only; Google sign-in and the auth identity stay intact.
                    </p>
                </div>
            </div>
        );
    }

    function TemplatesTab() {
        const [templates, setTemplates] = useState<any[]>([]);
        const [showCreateForm, setShowCreateForm] = useState(false);
        const [newTemplate, setNewTemplate] = useState({
            name: '',
            description: '',
            templateData: '',
            targetAudience: 'all_users'
        });

        useEffect(() => { loadTemplates(); }, []);

        async function loadTemplates() {
            const result = await adminAPI('list_templates');
            if (result.success) {
                setTemplates(result.data.templates || []);
            }
        }

        async function createTemplate() {
            if (!newTemplate.name || !newTemplate.templateData) {
                setMessage({ type: 'error', text: 'Name and template data required' });
                return;
            }
            setActionLoading(true);
            try {
                const result = await adminAPI('create_template', {
                    name: newTemplate.name,
                    description: newTemplate.description,
                    templateData: JSON.parse(newTemplate.templateData),
                    targetAudience: newTemplate.targetAudience
                });
                if (result.success) {
                    setMessage({ type: 'success', text: 'Template created!' });
                    setShowCreateForm(false);
                    setNewTemplate({ name: '', description: '', templateData: '', targetAudience: 'all_users' });
                    loadTemplates();
                } else {
                    setMessage({ type: 'error', text: result.error || 'Failed to create template' });
                }
            } catch (e: any) {
                setMessage({ type: 'error', text: 'Invalid JSON in template data' });
            }
            setActionLoading(false);
        }

        async function deleteTemplate(id: string) {
            if (!confirm('Delete this template?')) return;
            setActionLoading(true);
            const result = await adminAPI('delete_template', { templateId: id });
            if (result.success) {
                setMessage({ type: 'success', text: 'Template deleted' });
                loadTemplates();
            }
            setActionLoading(false);
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Food Generation Templates</h2>
                    <button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> New Template
                    </button>
                </div>

                {showCreateForm && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <h3 className="font-semibold mb-4">Create New Template</h3>
                        <div className="grid gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Template Name</label>
                                <input
                                    type="text"
                                    value={newTemplate.name}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                    placeholder="e.g., Quick Breakfast Ideas"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Description</label>
                                <input
                                    type="text"
                                    value={newTemplate.description}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                                    placeholder="Short description of this template"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Target Audience</label>
                                <select
                                    value={newTemplate.targetAudience}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, targetAudience: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                                >
                                    <option value="all_users">All Users</option>
                                    <option value="free">Free Users Only</option>
                                    <option value="basic">Basic Users Only</option>
                                    <option value="pro">Pro Users Only</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Template Data (JSON)</label>
                                <textarea
                                    value={newTemplate.templateData}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, templateData: e.target.value })}
                                    placeholder='{"meals": ["Poha", "Upma"], "cuisines": ["North Indian", "South Indian"]}'
                                    rows={4}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 font-mono text-sm"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={createTemplate}
                                    disabled={actionLoading}
                                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                >
                                    Create Template
                                </button>
                                <button
                                    onClick={() => setShowCreateForm(false)}
                                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Existing Templates */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Name</th>
                                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Description</th>
                                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Target</th>
                                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Created</th>
                                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {templates.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        No templates yet. Create your first template above.
                                    </td>
                                </tr>
                            ) : (
                                templates.map((t: any) => (
                                    <tr key={t.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium">{t.name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{t.description || '-'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.target_audience === 'pro' ? 'bg-purple-100 text-purple-700' :
                                                t.target_audience === 'basic' ? 'bg-blue-100 text-blue-700' :
                                                    t.target_audience === 'free' ? 'bg-gray-100 text-gray-700' :
                                                        'bg-green-100 text-green-700'
                                                }`}>
                                                {t.target_audience || 'all_users'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {new Date(t.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => deleteTemplate(t.id)}
                                                className="text-red-600 hover:text-red-700 flex items-center gap-1 text-sm"
                                            >
                                                <Trash2 className="w-4 h-4" /> Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    function HistoryTab() {
        const [history, setHistory] = useState<any[]>([]);
        const [loading, setLoading] = useState(true);

        useEffect(() => { loadHistory(); }, []);

        async function loadHistory() {
            setLoading(true);
            const result = await adminAPI('get_admin_history');
            if (result.success) {
                setHistory(result.data.history || []);
            }
            setLoading(false);
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Admin Action History</h2>
                    <button onClick={loadHistory} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
                        <RefreshCw className="w-4 h-4 inline mr-2" />Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent"></div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Time</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Admin</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Action</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Target User</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {history.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                            No admin actions recorded yet.
                                        </td>
                                    </tr>
                                ) : (
                                    history.map((h: any) => (
                                        <tr key={h.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                {new Date(h.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm">{h.admin_email}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${h.action_type === 'delete_user' ? 'bg-red-100 text-red-700' :
                                                    h.action_type === 'block_user' ? 'bg-orange-100 text-orange-700' :
                                                        h.action_type === 'modify_credits' ? 'bg-green-100 text-green-700' :
                                                            'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {h.action_type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                {h.target_email || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-400">
                                                {h.details ? JSON.stringify(h.details).slice(0, 50) : '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    }

    // Feature Matrix Tab Component
    function FeatureMatrixTab() {
        const [featureMatrix, setFeatureMatrix] = useState<Record<string, Record<string, boolean>>>({});
        const [tiers, setTiers] = useState<{ id: string, name: string }[]>([]);
        const [features, setFeatures] = useState<string[]>([]);
        const [matrixLoading, setMatrixLoading] = useState(true);
        const [saving, setSaving] = useState<string | null>(null);

        useEffect(() => { loadFeatureMatrix(); }, []);

        async function loadFeatureMatrix() {
            setMatrixLoading(true);
            try {
                const result = await adminAPI('get_feature_matrix');
                if (result.success) {
                    setFeatureMatrix(result.data.featureMap || {});
                    setTiers(result.data.tiers || []);
                    setFeatures(result.data.features || []);
                }
            } catch (e) {
                setMessage({ type: 'error', text: 'Failed to load feature matrix' });
            }
            setMatrixLoading(false);
        }

        async function toggleFeature(featureId: string, tierId: string, currentValue: boolean) {
            const key = `${featureId}-${tierId}`;
            setSaving(key);
            try {
                const result = await adminAPI('update_feature_access', {
                    featureId,
                    tierId,
                    enabled: !currentValue
                });
                if (result.success) {
                    const persistedEnabled = result.data?.featureAccess?.enabled ?? !currentValue;
                    setFeatureMatrix(prev => ({
                        ...prev,
                        [featureId]: {
                            ...prev[featureId],
                            [tierId]: persistedEnabled
                        }
                    }));
                    setMessage({ type: 'success', text: result.data.message });
                } else {
                    setMessage({ type: 'error', text: result.error || 'Failed to update' });
                }
            } catch (e) {
                setMessage({ type: 'error', text: 'Failed to update feature access' });
            }
            setSaving(null);
        }

        const featureLabels = Object.fromEntries(
            Object.entries(FEATURE_DESCRIPTIONS).map(([feature, description]) => [feature, description.name])
        );

        const tierOrder = ['free', 'basic', 'byok', 'pro', 'family_pro'];
        const sortedTiers = tiers.sort((a, b) => tierOrder.indexOf(a.id) - tierOrder.indexOf(b.id));

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Feature Access Matrix</h2>
                    <button
                        onClick={loadFeatureMatrix}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                </div>

                <p className="text-gray-500">Control which features are available for each subscription tier. Changes take effect immediately.</p>

                {matrixLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent"></div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 min-w-[200px]">Feature</th>
                                    {sortedTiers.map(tier => (
                                        <th key={tier.id} className="text-center px-4 py-3 text-sm font-medium text-gray-500 min-w-[100px]">
                                            <span className={`px-2 py-1 rounded-full text-xs ${tier.id === 'pro' ? 'bg-purple-100 text-purple-700' :
                                                tier.id === 'family_pro' ? 'bg-pink-100 text-pink-700' :
                                                    tier.id === 'basic' ? 'bg-blue-100 text-blue-700' :
                                                        tier.id === 'byok' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-gray-100 text-gray-700'}`}>
                                                {tier.name || tier.id}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {features.map(feature => (
                                    <tr key={feature} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm font-medium text-gray-700">
                                            {featureLabels[feature] || feature}
                                        </td>
                                        {sortedTiers.map(tier => {
                                            const isEnabled = featureMatrix[feature]?.[tier.id] ?? false;
                                            const isSaving = saving === `${feature}-${tier.id}`;
                                            return (
                                                <td key={tier.id} className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => toggleFeature(feature, tier.id, isEnabled)}
                                                        disabled={isSaving}
                                                        className={`p-2 rounded-lg transition-colors ${isSaving ? 'opacity-50' : ''}`}
                                                    >
                                                        {isSaving ? (
                                                            <div className="w-6 h-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent"></div>
                                                        ) : isEnabled ? (
                                                            <ToggleRight className="w-8 h-8 text-green-500" />
                                                        ) : (
                                                            <ToggleLeft className="w-8 h-8 text-gray-300" />
                                                        )}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Launch Offer Section */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-purple-900 flex items-center gap-2">
                                🎉 Launch Offer
                            </h3>
                            <p className="text-sm text-purple-600">Give all new users 30-day access to Family Pro features</p>
                        </div>
                        <LaunchOfferToggle />
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-amber-800 text-sm">
                        <strong>Note:</strong> Changes are saved automatically when you toggle a feature. Users will see the new access immediately on their next page load.
                    </p>
                </div>
            </div>
        );
    }

    // Notifications Tab Component
    function NotificationsTab() {
        const [notificationTitle, setNotificationTitle] = useState('');
        const [notificationBody, setNotificationBody] = useState('');
        const [targetType, setTargetType] = useState<'all' | 'specific' | 'tier'>('all');
        const [targetTier, setTargetTier] = useState('pro');
        const [targetUserSearch, setTargetUserSearch] = useState('');
        const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
        const [searchResults, setSearchResults] = useState<any[]>([]);
        const [history, setHistory] = useState<any[]>([]);
        const [stats, setStats] = useState<any>(null);
        const [sending, setSending] = useState(false);
        const [loadingHistory, setLoadingHistory] = useState(true);

        useEffect(() => {
            loadNotificationHistory();
            loadPushStats();
        }, []);

        async function loadNotificationHistory() {
            setLoadingHistory(true);
            const result = await adminAPI('list_notifications');
            if (result.success) {
                setHistory(result.data.notifications || []);
            }
            setLoadingHistory(false);
        }

        async function loadPushStats() {
            const result = await adminAPI('get_push_token_stats');
            if (result.success) {
                setStats(result.data);
            }
        }

        async function searchTargetUsers() {
            if (targetUserSearch.length < 3) return;
            const result = await adminAPI('search_user', { query: targetUserSearch });
            if (result.success) {
                setSearchResults(result.data.users || []);
            }
        }

        function addTargetUser(userId: string) {
            if (!selectedUsers.includes(userId)) {
                setSelectedUsers([...selectedUsers, userId]);
            }
            setSearchResults([]);
            setTargetUserSearch('');
        }

        async function sendNotification() {
            if (!notificationTitle.trim() || !notificationBody.trim()) {
                setMessage({ type: 'error', text: 'Title and body are required' });
                return;
            }

            if (targetType === 'specific' && selectedUsers.length === 0) {
                setMessage({ type: 'error', text: 'Select at least one user' });
                return;
            }

            setSending(true);
            try {
                const result = await adminAPI('send_notification', {
                    title: notificationTitle,
                    body: notificationBody,
                    targetType,
                    targetUserIds: targetType === 'specific' ? selectedUsers : undefined,
                    targetTier: targetType === 'tier' ? targetTier : undefined
                });

                if (result.success) {
                    setMessage({ type: 'success', text: result.data.message || 'Notification sent!' });
                    setNotificationTitle('');
                    setNotificationBody('');
                    setSelectedUsers([]);
                    loadNotificationHistory();
                } else {
                    setMessage({ type: 'error', text: result.error || 'Failed to send notification' });
                }
            } catch (e) {
                setMessage({ type: 'error', text: 'Failed to send notification' });
            }
            setSending(false);
        }

        return (
            <div className="space-y-6">
                <h2 className="text-xl font-semibold">Push Notifications</h2>

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm border">
                            <p className="text-sm text-gray-500">Registered Devices</p>
                            <p className="text-2xl font-bold text-indigo-600">{stats.totalTokens}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border">
                            <p className="text-sm text-gray-500">New This Week</p>
                            <p className="text-2xl font-bold text-green-600">{stats.recentRegistrations}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border">
                            <p className="text-sm text-gray-500">By Device</p>
                            <div className="text-sm text-gray-700">
                                {Object.entries(stats.byDevice || {}).map(([type, count]) => (
                                    <span key={type} className="mr-2">{type}: {count as number}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Compose Notification */}
                <div className="bg-white p-6 rounded-xl shadow-sm border">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Send className="w-5 h-5 text-orange-500" />
                        Compose Notification
                    </h3>

                    <div className="grid gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Title</label>
                            <input
                                type="text"
                                value={notificationTitle}
                                onChange={(e) => setNotificationTitle(e.target.value)}
                                placeholder="📣 Exciting Update!"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                                maxLength={50}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Body</label>
                            <textarea
                                value={notificationBody}
                                onChange={(e) => setNotificationBody(e.target.value)}
                                placeholder="We've added new features..."
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                                rows={3}
                                maxLength={200}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Target Audience</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setTargetType('all')}
                                    className={`px-4 py-2 rounded-lg border ${targetType === 'all' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white hover:bg-gray-50'}`}
                                >
                                    All Users
                                </button>
                                <button
                                    onClick={() => setTargetType('tier')}
                                    className={`px-4 py-2 rounded-lg border ${targetType === 'tier' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white hover:bg-gray-50'}`}
                                >
                                    By Tier
                                </button>
                                <button
                                    onClick={() => setTargetType('specific')}
                                    className={`px-4 py-2 rounded-lg border ${targetType === 'specific' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white hover:bg-gray-50'}`}
                                >
                                    Specific Users
                                </button>
                            </div>
                        </div>

                        {targetType === 'tier' && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Select Tier</label>
                                <select
                                    value={targetTier}
                                    onChange={(e) => setTargetTier(e.target.value)}
                                    className="px-4 py-2 border rounded-lg"
                                >
                                    <option value="free">Free</option>
                                    <option value="basic">Basic</option>
                                    <option value="pro">Pro</option>
                                </select>
                            </div>
                        )}

                        {targetType === 'specific' && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Search Users</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={targetUserSearch}
                                        onChange={(e) => setTargetUserSearch(e.target.value)}
                                        placeholder="Email..."
                                        className="flex-1 px-4 py-2 border rounded-lg"
                                    />
                                    <button
                                        onClick={searchTargetUsers}
                                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                                    >
                                        <Search className="w-4 h-4" />
                                    </button>
                                </div>

                                {searchResults.length > 0 && (
                                    <div className="mt-2 border rounded-lg divide-y">
                                        {searchResults.map((u: any) => (
                                            <button
                                                key={u.user_id}
                                                onClick={() => addTargetUser(u.user_id)}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-50"
                                            >
                                                {u.email || 'Unknown email'} <span className="text-gray-400 text-sm">({u.current_tier})</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {selectedUsers.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {selectedUsers.map((id) => (
                                            <span key={id} className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-sm flex items-center gap-1">
                                                User {id.slice(0, 8)}...
                                                <button onClick={() => setSelectedUsers(selectedUsers.filter(u => u !== id))}>
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={sendNotification}
                            disabled={sending || !notificationTitle || !notificationBody}
                            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {sending ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Send Notification
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Notification History */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="px-6 py-4 border-b flex items-center justify-between">
                        <h3 className="font-semibold">Notification History</h3>
                        <button onClick={loadNotificationHistory} className="text-sm text-orange-600 hover:text-orange-700">
                            <RefreshCw className="w-4 h-4 inline mr-1" />Refresh
                        </button>
                    </div>

                    {loadingHistory ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-orange-500 border-t-transparent"></div>
                        </div>
                    ) : history.length === 0 ? (
                        <p className="px-6 py-8 text-center text-gray-500">No notifications sent yet</p>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Sent</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Title</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Target</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Delivered</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {history.map((n: any) => (
                                    <tr key={n.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {new Date(n.sent_at).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-sm">{n.title}</p>
                                            <p className="text-xs text-gray-500 truncate max-w-xs">{n.body}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${n.target_type === 'all' ? 'bg-green-100 text-green-700' :
                                                    n.target_type === 'tier' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-blue-100 text-blue-700'
                                                }`}>
                                                {n.target_type === 'tier' ? n.target_tier : n.target_type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className="text-green-600">{n.success_count}</span>
                                            {n.failure_count > 0 && (
                                                <span className="text-red-600 ml-1">/ {n.failure_count} failed</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{n.sent_by_email}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-amber-800 text-sm">
                        <strong>Note:</strong> Push notifications require Firebase Cloud Messaging (FCM) to be configured on the server.
                        Users must have the native app installed and have granted notification permissions.
                    </p>
                </div>
            </div>
        );
    }

    // Launch Offer Toggle Component
    function LaunchOfferToggle() {
        const [launchOffer, setLaunchOffer] = useState<{ enabled: boolean; trial_days: number; effective_tier: string }>({ enabled: true, trial_days: 30, effective_tier: 'family_pro' });
        const [loading, setLoading] = useState(true);
        const [saving, setSaving] = useState(false);

        useEffect(() => {
            loadLaunchOffer();
        }, []);

        async function loadLaunchOffer() {
            const result = await adminAPI('get_launch_offer');
            if (result.success && result.data) {
                setLaunchOffer(result.data);
            }
            setLoading(false);
        }

        async function toggleLaunchOffer() {
            setSaving(true);
            const result = await adminAPI('update_launch_offer', {
                enabled: !launchOffer.enabled,
                trial_days: launchOffer.trial_days,
                effective_tier: launchOffer.effective_tier
            });
            if (result.success) {
                setLaunchOffer(prev => ({ ...prev, enabled: !prev.enabled }));
                setMessage({ type: 'success', text: `Launch offer ${!launchOffer.enabled ? 'enabled' : 'disabled'}` });
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to update' });
            }
            setSaving(false);
        }

        if (loading) return <div className="animate-pulse w-16 h-8 bg-purple-200 rounded-full"></div>;

        return (
            <div className="flex items-center gap-4">
                <div className="text-right">
                    <p className="text-sm font-medium text-purple-700">{launchOffer.trial_days} days</p>
                    <p className="text-xs text-purple-500 capitalize">{launchOffer.effective_tier.replace('_', ' ')}</p>
                </div>
                <button
                    onClick={toggleLaunchOffer}
                    disabled={saving}
                    className={`relative w-14 h-8 rounded-full transition-colors ${saving ? 'opacity-50' : ''} ${launchOffer.enabled ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gray-300'}`}
                >
                    <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${launchOffer.enabled ? 'translate-x-6' : ''}`} />
                </button>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'features', label: 'Feature Matrix', icon: Grid3X3 },
        { id: 'templates', label: 'Templates', icon: CreditCard },
        { id: 'history', label: 'History', icon: AlertTriangle },
        { id: 'test', label: 'Test Accounts', icon: TestTube },
        { id: 'access', label: 'Access Control', icon: Shield },
    ];

    return (
        <div className="app-safe-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                    <a href="/dashboard" className="text-sm text-orange-600 hover:text-orange-700">
                        ← Back to App
                    </a>
                </div>
            </div>

            {/* Message Toast */}
            {message && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white flex items-center gap-2`}>
                    {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    {message.text}
                    <button onClick={() => setMessage(null)}><X className="w-4 h-4" /></button>
                </div>
            )}

            <div className="flex">
                {/* Sidebar */}
                <div
                    className="w-64 bg-white border-r border-gray-200"
                    style={{ minHeight: 'calc(100dvh - var(--app-safe-top) - var(--app-safe-bottom) - 65px)' }}
                >
                    <nav className="p-4 space-y-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === tab.id
                                    ? 'bg-orange-50 text-orange-700'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <tab.icon className="w-5 h-5" />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Main Content */}
                <div className="flex-1 p-6">
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold">Analytics Overview</h2>

                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent"></div>
                                </div>
                            ) : analytics ? (
                                <>
                                    {/* Stats Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                            <p className="text-sm text-gray-500">Active Users (7d)</p>
                                            <p className="text-3xl font-bold text-gray-900">{analytics.activeUsers7d}</p>
                                        </div>
                                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                            <p className="text-sm text-gray-500">Total Users</p>
                                            <p className="text-3xl font-bold text-gray-900">{analytics.totalUsers}</p>
                                        </div>
                                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                            <p className="text-sm text-gray-500">Credits Used (7d)</p>
                                            <p className="text-3xl font-bold text-gray-900">{analytics.creditsUsed7d}</p>
                                        </div>
                                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                            <p className="text-sm text-gray-500">Total Revenue</p>
                                            <p className="text-3xl font-bold text-gray-900">₹{analytics.totalRevenueINR.toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {/* Plan Distribution */}
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                        <h3 className="text-lg font-semibold mb-4">Plan Distribution</h3>
                                        <div className="flex gap-4 flex-wrap">
                                            {Object.entries(analytics.planDistribution).map(([plan, count]) => (
                                                <div key={plan} className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg">
                                                    <span className="font-medium capitalize">{plan}:</span>
                                                    <span className="text-gray-600">{count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <p className="text-gray-500">Failed to load analytics</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold">User Management</h2>

                            {/* Search */}
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                                        placeholder="Search by email..."
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                    />
                                </div>
                                <button
                                    onClick={searchUsers}
                                    className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                                >
                                    Search
                                </button>
                            </div>

                            {/* User List */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Email</th>
                                            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Plan</th>
                                            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Credits</th>
                                            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Last Active</th>
                                            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {users.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                                    Search for users by email
                                                </td>
                                            </tr>
                                        ) : (
                                            users.map(u => (
                                                <tr key={u.user_id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 text-sm">{u.email || 'Unknown email'}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${u.current_tier === 'pro' ? 'bg-purple-100 text-purple-700' :
                                                            u.current_tier === 'basic' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-gray-100 text-gray-700'
                                                            }`}>
                                                            {u.current_tier || 'free'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm">
                                                        <div className="font-medium text-gray-900">{u.active_credits ?? 0} active</div>
                                                        <div className="text-xs text-amber-600">{u.bonus_credits ?? 0} bonus</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : 'Never'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <button
                                                            onClick={() => loadUserDetails(u.user_id)}
                                                            className="text-orange-600 hover:text-orange-700 flex items-center gap-1"
                                                        >
                                                            View Details <ChevronRight className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'access' && (
                        <AccessControlTab />
                    )}

                    {activeTab === 'test' && (
                        <TestAccountsTab />
                    )}

                    {activeTab === 'analytics' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold">Detailed Analytics</h2>
                                <button
                                    onClick={loadDetailedAnalytics}
                                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                                >
                                    <RefreshCw className="w-4 h-4 inline mr-2" />Refresh
                                </button>
                            </div>

                            {!detailedAnalytics ? (
                                <div className="text-center py-12">
                                    <button
                                        onClick={loadDetailedAnalytics}
                                        className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                                    >
                                        Load Detailed Analytics
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Summary Stats */}
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                        <div className="bg-white p-4 rounded-xl shadow-sm border">
                                            <p className="text-sm text-gray-500">Total Users</p>
                                            <p className="text-2xl font-bold">{detailedAnalytics.totalUsers}</p>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl shadow-sm border">
                                            <p className="text-sm text-gray-500">Active (7d)</p>
                                            <p className="text-2xl font-bold text-green-600">{detailedAnalytics.activeUsers7d}</p>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl shadow-sm border">
                                            <p className="text-sm text-gray-500">Active (30d)</p>
                                            <p className="text-2xl font-bold text-blue-600">{detailedAnalytics.activeUsers30d}</p>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl shadow-sm border">
                                            <p className="text-sm text-gray-500">Total Profiles</p>
                                            <p className="text-2xl font-bold">{detailedAnalytics.totalProfiles}</p>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl shadow-sm border">
                                            <p className="text-sm text-gray-500">Meal Plans</p>
                                            <p className="text-2xl font-bold">{detailedAnalytics.totalMealPlans}</p>
                                        </div>
                                    </div>

                                    {/* Generations by Type */}
                                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                                        <h3 className="font-semibold mb-4">Generations by Type (30d)</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {Object.entries(detailedAnalytics.generationsByType).map(([type, data]) => (
                                                <div key={type} className="bg-gray-50 p-4 rounded-lg">
                                                    <p className="text-sm text-gray-500 capitalize">{type.replace('_', ' ')}</p>
                                                    <p className="text-xl font-bold">{data.count}</p>
                                                    <p className="text-xs text-gray-400">{data.credits} credits</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Daily Trend */}
                                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                                        <h3 className="font-semibold mb-4">Daily Generation Trend (7d)</h3>
                                        <div className="flex gap-2 items-end h-32">
                                            {Object.entries(detailedAnalytics.dailyTrend).map(([date, count]) => {
                                                const maxCount = Math.max(...Object.values(detailedAnalytics.dailyTrend), 1);
                                                const height = (count / maxCount) * 100;
                                                return (
                                                    <div key={date} className="flex-1 flex flex-col items-center">
                                                        <div
                                                            className="w-full bg-orange-400 rounded-t"
                                                            style={{ height: `${height}%` }}
                                                        />
                                                        <p className="text-xs text-gray-500 mt-1">{date.slice(-5)}</p>
                                                        <p className="text-xs font-medium">{count}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Insights */}
                                    {insights && (
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div className="bg-white p-6 rounded-xl shadow-sm border">
                                                <h3 className="font-semibold mb-4">Top Dietary Types</h3>
                                                <div className="space-y-2">
                                                    {insights.topDietaryTypes.map((d, i) => (
                                                        <div key={i} className="flex justify-between items-center">
                                                            <span>{d.type}</span>
                                                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm">{d.count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="bg-white p-6 rounded-xl shadow-sm border">
                                                <h3 className="font-semibold mb-4">Top Dislikes</h3>
                                                <div className="space-y-2">
                                                    {insights.topDislikes.slice(0, 5).map((d, i) => (
                                                        <div key={i} className="flex justify-between items-center">
                                                            <span>{d.item}</span>
                                                            <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-sm">{d.count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="bg-white p-6 rounded-xl shadow-sm border">
                                                <h3 className="font-semibold mb-4">Peak Usage Hours</h3>
                                                <div className="space-y-2">
                                                    {insights.peakHours.map((h, i) => (
                                                        <div key={i} className="flex justify-between items-center">
                                                            <span>{h.hour}:00 - {h.hour + 1}:00</span>
                                                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm">{h.count} actions</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="bg-white p-6 rounded-xl shadow-sm border">
                                                <h3 className="font-semibold mb-4">Feature Adoption (unique users)</h3>
                                                <div className="space-y-2">
                                                    {Object.entries(insights.featureAdoption).map(([feature, count], i) => (
                                                        <div key={i} className="flex justify-between items-center">
                                                            <span className="capitalize">{feature.replace('_', ' ')}</span>
                                                            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-sm">{count} users</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'templates' && (
                        <TemplatesTab />
                    )}

                    {activeTab === 'features' && (
                        <FeatureMatrixTab />
                    )}

                    {activeTab === 'history' && (
                        <HistoryTab />
                    )}

                    {activeTab === 'notifications' && (
                        <NotificationsTab />
                    )}
                </div>
            </div>

            {/* User Details Modal */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{selectedUser.user?.email || 'Unknown email'}</h3>
                            <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Status */}
                            <div className="flex items-center gap-4">
                                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${selectedUser.subscription?.plan_id === 'pro' ? 'bg-purple-100 text-purple-700' :
                                    selectedUser.subscription?.plan_id === 'basic' ? 'bg-blue-100 text-blue-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                    {selectedUser.subscription?.plan_id || 'free'}
                                </span>
                                {selectedUser.isBlocked && (
                                    <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
                                        BLOCKED
                                    </span>
                                )}
                            </div>

                            {/* Credits Table */}
                            <div>
                                <h4 className="font-medium mb-3">Credits</h4>
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="text-left px-4 py-2">Type</th>
                                            <th className="text-left px-4 py-2">Meal</th>
                                            <th className="text-left px-4 py-2">Grocery</th>
                                            <th className="text-left px-4 py-2">Edit</th>
                                            <th className="text-left px-4 py-2">Regen</th>
                                            <th className="text-left px-4 py-2">Expires</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {selectedUser.credits?.map((c: any, i: number) => (
                                            <tr key={i}>
                                                <td className="px-4 py-2 capitalize">{c.credit_type}</td>
                                                <td className="px-4 py-2">{c.meal_credits}</td>
                                                <td className="px-4 py-2">{c.grocery_credits}</td>
                                                <td className="px-4 py-2">{c.edit_credits}</td>
                                                <td className="px-4 py-2">{c.regen_credits}</td>
                                                <td className="px-4 py-2 text-gray-500">
                                                    {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Never'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Quick Actions */}
                            <div>
                                <h4 className="font-medium mb-3">Quick Actions</h4>

                                {/* Tier Change Dropdown */}
                                <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                                    <label className="text-sm font-medium text-gray-700">Change Tier:</label>
                                    <select
                                        value={selectedUser.subscription?.plan_id || 'free'}
                                        onChange={(e) => changeTier(e.target.value)}
                                        disabled={actionLoading}
                                        className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                                    >
                                        <option value="free">Free</option>
                                        <option value="basic">Basic</option>
                                        <option value="pro">Pro</option>
                                        <option value="byok">BYOK</option>
                                    </select>
                                    {selectedUser.subscription?.razorpay_subscription_id && (
                                        <button
                                            onClick={cancelRazorpay}
                                            disabled={actionLoading}
                                            className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-sm font-medium"
                                        >
                                            Cancel Razorpay
                                        </button>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setCreditModal({ open: true, operation: 'add', creditType: 'meal', sourceType: 'admin', expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] })}
                                        className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                                    >
                                        <Plus className="w-4 h-4" /> Add Meal Credits
                                    </button>
                                    <button
                                        onClick={() => setCreditModal({ open: true, operation: 'remove', creditType: 'meal', sourceType: 'admin', expiresAt: '' })}
                                        className="flex items-center gap-1 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
                                    >
                                        <Minus className="w-4 h-4" /> Remove Meal Credits
                                    </button>
                                    <button
                                        onClick={resetAccount}
                                        disabled={actionLoading}
                                        className="flex items-center gap-1 px-3 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200"
                                    >
                                        <RefreshCw className="w-4 h-4" /> Reset Account
                                    </button>
                                    <button
                                        onClick={toggleBlock}
                                        disabled={actionLoading}
                                        className={`flex items-center gap-1 px-3 py-2 rounded-lg ${selectedUser.isBlocked
                                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                                            }`}
                                    >
                                        <Ban className="w-4 h-4" /> {selectedUser.isBlocked ? 'Unblock' : 'Block User'}
                                    </button>
                                    <button
                                        onClick={deleteUser}
                                        disabled={actionLoading}
                                        className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                    >
                                        <Trash2 className="w-4 h-4" /> Delete User
                                    </button>
                                </div>
                            </div>

                            {/* Recent Usage */}
                            <div>
                                <h4 className="font-medium mb-3">Recent Usage</h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {selectedUser.recentUsage?.slice(0, 10).map((u: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between text-sm bg-gray-50 px-3 py-2 rounded-lg">
                                            <span>{u.action_type}</span>
                                            <span className="text-gray-500">{new Date(u.created_at).toLocaleString()}</span>
                                        </div>
                                    ))}
                                    {(!selectedUser.recentUsage || selectedUser.recentUsage.length === 0) && (
                                        <p className="text-gray-500 text-sm">No usage history</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Credit Modification Modal */}
            {creditModal?.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
                    <div className="bg-white rounded-xl p-6 w-96">
                        <h4 className="text-lg font-medium mb-4">
                            {creditModal.operation === 'add' ? 'Add' : 'Remove'} Credits
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Credit Type</label>
                                <select
                                    value={creditModal.creditType}
                                    onChange={(e) => setCreditModal({ ...creditModal, creditType: e.target.value })}
                                    className="w-full p-2 border border-gray-200 rounded-lg"
                                >
                                    <option value="meal">Meal Credits</option>
                                    <option value="grocery">Grocery Credits</option>
                                    <option value="edit">Edit Credits</option>
                                    <option value="regen">Regen Credits</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Amount</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={creditAmount}
                                    onChange={(e) => setCreditAmount(parseInt(e.target.value) || 1)}
                                    className="w-full p-2 border border-gray-200 rounded-lg"
                                />
                            </div>
                            {creditModal.operation === 'add' && (
                                <>
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Source Type</label>
                                        <select
                                            value={creditModal.sourceType}
                                            onChange={(e) => setCreditModal({ ...creditModal, sourceType: e.target.value as 'bonus' | 'pack' | 'admin' })}
                                            className="w-full p-2 border border-gray-200 rounded-lg"
                                        >
                                            <option value="admin">Admin (Manual)</option>
                                            <option value="bonus">Bonus (Weekly)</option>
                                            <option value="pack">Pack (Purchased)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Expires At</label>
                                        <input
                                            type="date"
                                            value={creditModal.expiresAt}
                                            onChange={(e) => setCreditModal({ ...creditModal, expiresAt: e.target.value })}
                                            className="w-full p-2 border border-gray-200 rounded-lg"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Leave empty for 30-day default</p>
                                    </div>
                                </>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCreditModal(null)}
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={modifyCredits}
                                    disabled={actionLoading}
                                    className={`flex-1 px-4 py-2 text-white rounded-lg ${creditModal.operation === 'add' ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'
                                        }`}
                                >
                                    {actionLoading ? 'Processing...' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
