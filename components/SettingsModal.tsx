import React, { useState, useEffect } from 'react';
import { X, Key, Save, Crown, Sparkles, CreditCard, Zap, Trash2, AlertTriangle, Users, User, Phone, MapPin, Settings, Gift, CreditCard as CardIcon, LogOut, HelpCircle, ExternalLink, ChevronRight, Download, Bell, BellOff } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import { updateBillingPreference, getBillingPreference } from '../services/subscriptionService';
import { getUserProfile, saveUserProfile } from '../services/supabaseService';
import ReferralShareCard from './ReferralShareCard';
import FamilyModeSettings from './FamilyModeSettings';
import { notificationService, DEFAULT_NOTIFICATION_SETTINGS, NotificationSettings } from '../services/notificationService';
import { isNative } from '../utils/platform';

interface SettingsModalProps {
    onClose: () => void;
    canClose: boolean;
    onDeleteAccount?: () => void;
    onInstallPWA?: () => void;
}

type SettingsTab = 'profile' | 'family' | 'subscription' | 'account';

export default function SettingsModal({ onClose, canClose, onDeleteAccount, onInstallPWA }: SettingsModalProps) {
    const { apiKey, setApiKey } = useSettings();
    const { subscription, credits } = useSubscription();
    const { user, signOut } = useAuth();

    const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
    const [localKey, setLocalKey] = useState(apiKey);
    const [showKey, setShowKey] = useState(false);
    const [billingPref, setBillingPref] = useState<'credits' | 'byok'>('credits');
    const [savingPref, setSavingPref] = useState(false);

    // Profile details state
    const [displayName, setDisplayName] = useState('');
    const [phone, setPhone] = useState('');
    const [city, setCity] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);

    // Notification settings state
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
    const [notificationPermission, setNotificationPermission] = useState<boolean | null>(null);
    const [testingNotification, setTestingNotification] = useState(false);

    // Check if user is on a paid plan (can use BYOK)
    const isPaidUser = subscription?.plan_id && ['basic', 'pro', 'byok'].includes(subscription.plan_id);
    const canUseBYOK = isPaidUser || credits?.byok_enabled;
    const hasApiKey = !!localKey?.trim();

    useEffect(() => {
        setLocalKey(apiKey);
    }, [apiKey]);

    // Load billing preference
    useEffect(() => {
        if (user?.id) {
            getBillingPreference(user.id).then(setBillingPref);
        }
    }, [user?.id]);

    // Load profile data
    useEffect(() => {
        if (user?.id) {
            getUserProfile(user.id).then(profile => {
                if (profile) {
                    setDisplayName(profile.displayName || '');
                    setPhone(profile.phone || '');
                    setCity(profile.city || '');
                }
            });
        }
    }, [user?.id]);

    // Check notification permission on mount
    useEffect(() => {
        if (isNative()) {
            notificationService.checkPermission().then(setNotificationPermission);
        }
    }, []);

    const handleSave = async () => {
        if (user?.id) {
            setSavingProfile(true);
            await saveUserProfile(user.id, { displayName, phone, city });
            setSavingProfile(false);
        }
        if (canUseBYOK) {
            setApiKey(localKey);
        }
        onClose();
    };

    const handleProfileSave = async () => {
        if (!user?.id) return;

        // Validate phone number if provided
        if (phone) {
            const cleaned = phone.replace(/\D/g, '');
            if (cleaned.length < 10) {
                alert('Please enter a valid phone number (minimum 10 digits)');
                return;
            }
        }

        setSavingProfile(true);
        await saveUserProfile(user.id, { displayName, phone, city });
        setSavingProfile(false);
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2000);
    };

    // Lock body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    // Tab button component
    const TabButton = ({ id, label, icon: Icon }: { id: SettingsTab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${activeTab === id
                ? 'text-indigo-600 border-indigo-600 bg-indigo-50/50'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                }`}
        >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4" style={{ minHeight: '100dvh' }}>
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden max-h-[95vh] sm:max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-purple-50 shrink-0">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                        <Settings className="w-5 h-5 text-indigo-600" />
                        Settings
                    </h3>
                    {canClose && (
                        <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    )}
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-gray-200 bg-white shrink-0 overflow-x-auto">
                    <TabButton id="profile" label="Profile" icon={User} />
                    <TabButton id="family" label="Family" icon={Users} />
                    <TabButton id="subscription" label="Plan & Refer" icon={Gift} />
                    <TabButton id="account" label="Account" icon={Settings} />
                </div>

                {/* Tab Content */}
                <div className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>

                    {/* ========== PROFILE TAB ========== */}
                    {activeTab === 'profile' && (
                        <div className="space-y-5">
                            {/* Profile Details */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <User className="w-4 h-4 text-indigo-500" />
                                    Profile Details
                                </h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Display Name</label>
                                        <input
                                            type="text"
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            placeholder="Your name"
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
                                            <Phone className="w-3 h-3" /> Phone Number
                                        </label>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="+91 98765 43210"
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
                                            <MapPin className="w-3 h-3" /> City
                                        </label>
                                        <input
                                            type="text"
                                            value={city}
                                            onChange={(e) => setCity(e.target.value)}
                                            placeholder="e.g. Mumbai, Delhi, Bangalore"
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50"
                                        />
                                    </div>
                                    <button
                                        onClick={handleProfileSave}
                                        disabled={savingProfile}
                                        className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${profileSaved
                                            ? 'bg-green-100 text-green-700 border border-green-200'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                                            }`}
                                    >
                                        {savingProfile ? 'Saving...' : profileSaved ? '✓ Saved!' : 'Save Profile'}
                                    </button>
                                </div>
                            </div>

                            {/* BYOK Section */}
                            <div className="space-y-3 pt-4 border-t border-gray-100">
                                <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <Key className="w-4 h-4 text-purple-500" />
                                    {canUseBYOK ? 'Your API Key (BYOK)' : 'Bring Your Own Key'}
                                    {canUseBYOK && <Crown className="w-4 h-4 text-amber-500" />}
                                </h4>

                                {canUseBYOK ? (
                                    <>
                                        <div className="relative">
                                            <input
                                                type={showKey ? "text" : "password"}
                                                value={localKey}
                                                onChange={(e) => setLocalKey(e.target.value)}
                                                placeholder="Enter your Gemini API Key"
                                                className="w-full px-4 py-2.5 pr-16 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowKey(!showKey)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-purple-600 font-medium px-2 py-1 bg-white rounded"
                                            >
                                                {showKey ? "HIDE" : "SHOW"}
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Use your own key for unlimited generations. <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-purple-600 hover:underline">Get a key here</a>.
                                        </p>
                                    </>
                                ) : (
                                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-purple-100 rounded-lg">
                                                <Sparkles className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-purple-900 mb-1">Upgrade to Use Your Own Key</p>
                                                <p className="text-sm text-purple-700 mb-3">
                                                    Get unlimited AI generations with your own Gemini API key.
                                                </p>
                                                <a
                                                    href="/plan"
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                                                >
                                                    <Crown className="w-4 h-4" />
                                                    View Plans
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Billing Preference Toggle */}
                            {canUseBYOK && hasApiKey && (
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
                                        <Zap className="w-4 h-4" />
                                        Billing Mode
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                if (user?.id && billingPref !== 'credits') {
                                                    setSavingPref(true);
                                                    await updateBillingPreference(user.id, 'credits');
                                                    setBillingPref('credits');
                                                    setSavingPref(false);
                                                }
                                            }}
                                            disabled={savingPref}
                                            className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${billingPref === 'credits'
                                                ? 'bg-orange-100 text-orange-700 border-2 border-orange-400 shadow-sm'
                                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            <CreditCard className="w-4 h-4" />
                                            Credits
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (user?.id && billingPref !== 'byok') {
                                                    setSavingPref(true);
                                                    await updateBillingPreference(user.id, 'byok');
                                                    setBillingPref('byok');
                                                    setSavingPref(false);
                                                }
                                            }}
                                            disabled={savingPref}
                                            className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${billingPref === 'byok'
                                                ? 'bg-purple-100 text-purple-700 border-2 border-purple-400 shadow-sm'
                                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            <Key className="w-4 h-4" />
                                            My Key
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        {billingPref === 'credits'
                                            ? 'Using platform credits for AI generations.'
                                            : 'Using your own API key for unlimited generations.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ========== FAMILY TAB ========== */}
                    {activeTab === 'family' && (
                        <div className="space-y-4">
                            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-orange-100 rounded-lg">
                                        <Users className="w-5 h-5 text-orange-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-orange-900">Family Mode</p>
                                        <p className="text-xs text-orange-600">Plan meals together with your partner or family</p>
                                    </div>
                                </div>
                            </div>
                            <FamilyModeSettings />
                        </div>
                    )}

                    {/* ========== SUBSCRIPTION & REFERRAL TAB ========== */}
                    {activeTab === 'subscription' && (
                        <div className="space-y-5">
                            {/* Current Plan Info */}
                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
                                <h4 className="text-sm font-bold text-indigo-800 mb-3 flex items-center gap-2">
                                    <Crown className="w-4 h-4" />
                                    Your Plan
                                </h4>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600 text-sm">Current Plan</span>
                                        <span className="font-bold text-indigo-700 capitalize">{subscription?.plan_id || 'Free'}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600 text-sm">Credits Remaining</span>
                                        <span className="font-bold text-indigo-700">{credits?.total_meal_credits || 0}</span>
                                    </div>
                                </div>
                                <a
                                    href="/plan"
                                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Manage Plan
                                </a>
                            </div>

                            {/* Referral Section */}
                            <ReferralShareCard />

                            {/* Cancel Subscription */}
                            {subscription?.plan_id && subscription.plan_id !== 'free' && subscription.status === 'active' && (
                                <div className="bg-red-50 rounded-xl p-4 text-sm border border-red-100">
                                    <h4 className="font-medium text-red-900 mb-2">Cancel Subscription</h4>
                                    <p className="text-red-700 text-xs mb-3">
                                        Cancelling will stop future billing. Access continues until the end of your billing cycle.
                                    </p>
                                    <button
                                        onClick={async () => {
                                            if (!confirm('Are you sure you want to cancel your subscription?')) return;
                                            const { cancelSubscriptionAPI } = await import('../services/subscriptionService');
                                            setSavingPref(true);
                                            try {
                                                const result = await cancelSubscriptionAPI(user!.id);
                                                if (result.success) {
                                                    alert('Subscription cancelled successfully.');
                                                    onClose();
                                                    window.location.reload();
                                                } else {
                                                    alert('Failed to cancel: ' + result.error);
                                                }
                                            } catch (e) {
                                                alert('An error occurred while cancelling.');
                                            } finally {
                                                setSavingPref(false);
                                            }
                                        }}
                                        disabled={savingPref}
                                        className="w-full py-2.5 px-3 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
                                    >
                                        {savingPref ? 'Processing...' : 'Cancel Subscription'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ========== ACCOUNT TAB ========== */}
                    {activeTab === 'account' && (
                        <div className="space-y-5">
                            {/* Notification Settings (Native only) */}
                            {isNative() && (
                                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                                    <h4 className="font-medium text-amber-900 flex items-center gap-2 mb-3">
                                        {notificationSettings.enabled ? (
                                            <Bell className="w-4 h-4 text-amber-600" />
                                        ) : (
                                            <BellOff className="w-4 h-4 text-gray-400" />
                                        )}
                                        Meal Reminders
                                    </h4>

                                    {/* Master Toggle */}
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm text-amber-800">Enable notifications</span>
                                        <button
                                            onClick={async () => {
                                                if (!notificationSettings.enabled) {
                                                    // Request permission if enabling
                                                    const granted = await notificationService.requestPermission();
                                                    setNotificationPermission(granted);
                                                    if (!granted) {
                                                        alert('Please enable notifications in your device settings');
                                                        return;
                                                    }
                                                }
                                                setNotificationSettings(prev => ({ ...prev, enabled: !prev.enabled }));
                                            }}
                                            className={`w-12 h-6 rounded-full transition-colors ${notificationSettings.enabled ? 'bg-amber-500' : 'bg-gray-300'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${notificationSettings.enabled ? 'translate-x-6' : 'translate-x-0.5'
                                                }`} />
                                        </button>
                                    </div>

                                    {notificationSettings.enabled && (
                                        <>
                                            {/* Reminder Times */}
                                            <div className="space-y-2 mb-4">
                                                <div className="flex items-center justify-between text-sm">
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={notificationSettings.breakfastEnabled}
                                                            onChange={(e) => setNotificationSettings(prev => ({ ...prev, breakfastEnabled: e.target.checked }))}
                                                            className="rounded text-amber-500"
                                                        />
                                                        <span>🍳 Breakfast</span>
                                                    </label>
                                                    <span className="text-amber-600">{String(notificationSettings.breakfastTime.hour).padStart(2, '0')}:{String(notificationSettings.breakfastTime.minute).padStart(2, '0')}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={notificationSettings.lunchEnabled}
                                                            onChange={(e) => setNotificationSettings(prev => ({ ...prev, lunchEnabled: e.target.checked }))}
                                                            className="rounded text-amber-500"
                                                        />
                                                        <span>🍲 Lunch</span>
                                                    </label>
                                                    <span className="text-amber-600">{String(notificationSettings.lunchTime.hour).padStart(2, '0')}:{String(notificationSettings.lunchTime.minute).padStart(2, '0')}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={notificationSettings.dinnerEnabled}
                                                            onChange={(e) => setNotificationSettings(prev => ({ ...prev, dinnerEnabled: e.target.checked }))}
                                                            className="rounded text-amber-500"
                                                        />
                                                        <span>🍽️ Dinner</span>
                                                    </label>
                                                    <span className="text-amber-600">{String(notificationSettings.dinnerTime.hour).padStart(2, '0')}:{String(notificationSettings.dinnerTime.minute).padStart(2, '0')}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={notificationSettings.weeklyPlanEnabled}
                                                            onChange={(e) => setNotificationSettings(prev => ({ ...prev, weeklyPlanEnabled: e.target.checked }))}
                                                            className="rounded text-amber-500"
                                                        />
                                                        <span>📅 Weekly Plan Reminder</span>
                                                    </label>
                                                    <span className="text-amber-600">Mon 9:00</span>
                                                </div>
                                            </div>

                                            {/* Test Button */}
                                            <button
                                                onClick={async () => {
                                                    setTestingNotification(true);
                                                    await notificationService.sendTestNotification();
                                                    setTestingNotification(false);
                                                }}
                                                disabled={testingNotification}
                                                className="w-full py-2 px-3 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
                                            >
                                                {testingNotification ? 'Sending...' : '🔔 Send Test Notification'}
                                            </button>
                                        </>
                                    )}

                                    {notificationPermission === false && (
                                        <p className="text-xs text-red-600 mt-2">
                                            ⚠️ Notifications blocked. Enable in device settings.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Support & Contact */}
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                <h4 className="font-medium text-gray-800 flex items-center gap-2 mb-3">
                                    <HelpCircle className="w-4 h-4 text-indigo-500" />
                                    Need Help?
                                </h4>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600">Email Support</span>
                                        <a href="mailto:akshaydewalwar1@gmail.com" className="font-medium text-indigo-600 hover:text-indigo-700">
                                            akshaydewalwar1@gmail.com
                                        </a>
                                    </div>
                                </div>
                            </div>

                            {/* Install Webapp */}
                            {onInstallPWA && (
                                <button
                                    onClick={() => {
                                        onClose();
                                        onInstallPWA();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-200 transition-colors"
                                >
                                    <Download className="w-4 h-4" />
                                    Install Webapp
                                </button>
                            )}

                            {/* Sign Out */}
                            <button
                                onClick={async () => {
                                    if (confirm('Are you sure you want to sign out?')) {
                                        await signOut();
                                        onClose();
                                    }
                                }}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign Out
                            </button>

                            {/* Danger Zone - Delete Account */}
                            {onDeleteAccount && (
                                <div className="mt-4 border-t border-red-200 pt-4">
                                    <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                                        <h4 className="font-medium text-red-900 flex items-center gap-2 mb-2">
                                            <AlertTriangle className="w-4 h-4" />
                                            Danger Zone
                                        </h4>
                                        <p className="text-xs text-red-700 mb-3">
                                            Permanently delete your account and all data. This cannot be undone.
                                        </p>
                                        <button
                                            onClick={() => {
                                                onClose();
                                                onDeleteAccount();
                                            }}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm rounded-xl hover:bg-red-700 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Delete Account
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="pt-4 text-center text-xs text-gray-400">
                                Built with ❤️ by Qook.in
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Save Button - Only show on Profile tab */}
                {activeTab === 'profile' && (
                    <div className="p-4 border-t border-gray-100 safe-area-inset-bottom shrink-0 bg-gray-50">
                        <button
                            onClick={handleSave}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm min-h-[44px]"
                        >
                            <Save className="w-4 h-4" />
                            Save & Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
