/**
 * FamilyModeModal Component
 * A dedicated modal for Family Mode accessed from the profile dropdown.
 * Shows family info, members, activity log, and management options.
 */

import React, { useState, useEffect } from 'react';
import {
    Users,
    X,
    Crown,
    Copy,
    Check,
    Share2,
    LogOut,
    RefreshCw,
    Trash2,
    Clock,
    Calendar,
    ShoppingCart,
    UserPlus,
    UserMinus,
    ChefHat,
    Link2
} from 'lucide-react';
import {
    FamilyGroup,
    FamilyMember,
    FamilyCreditPool,
    FamilyActivity,
    getUserFamilyGroup,
    createFamilyGroup,
    joinFamilyGroup,
    leaveFamilyGroup,
    getFamilyMembers,
    getFamilyCreditPool,
    getFamilyActivity,
    regenerateInviteCode,
    removeFamilyMember,
    generateInviteLink,
    subscribeToFamilyGroup,
    subscribeToFamilyActivity
} from '../services/familyService';
import { formatDistanceToNow } from 'date-fns';

interface FamilyModeModalProps {
    onClose: () => void;
    onFamilyStatusChange?: (isInFamily: boolean) => void;
}

export default function FamilyModeModal({ onClose, onFamilyStatusChange }: FamilyModeModalProps) {
    const [loading, setLoading] = useState(true);
    const [familyGroup, setFamilyGroup] = useState<FamilyGroup | null>(null);
    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [creditPool, setCreditPool] = useState<FamilyCreditPool | null>(null);
    const [activities, setActivities] = useState<FamilyActivity[]>([]);
    const [joinCode, setJoinCode] = useState('');
    const [showJoinForm, setShowJoinForm] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    // Load family data
    useEffect(() => {
        loadFamilyData();
    }, []);

    // Real-time subscriptions
    useEffect(() => {
        if (!familyGroup) return;

        const unsubscribeGroup = subscribeToFamilyGroup(
            familyGroup.id,
            (newMembers) => setMembers(newMembers),
            (newPool) => setCreditPool(newPool)
        );

        const unsubscribeActivity = subscribeToFamilyActivity(
            familyGroup.id,
            (newActivities) => setActivities(newActivities)
        );

        return () => {
            unsubscribeGroup();
            unsubscribeActivity();
        };
    }, [familyGroup?.id]);

    // Lock body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    async function loadFamilyData() {
        setLoading(true);
        try {
            const group = await getUserFamilyGroup();
            setFamilyGroup(group);

            if (group) {
                const [memberList, pool, activityList] = await Promise.all([
                    getFamilyMembers(group.id),
                    getFamilyCreditPool(group.id),
                    getFamilyActivity(group.id)
                ]);
                setMembers(memberList);
                setCreditPool(pool);
                setActivities(activityList);
            }
        } catch (err) {
            console.error('Error loading family data:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateFamily() {
        setProcessing(true);
        setError(null);
        try {
            await createFamilyGroup('My Family');
            await loadFamilyData();
            onFamilyStatusChange?.(true);
        } catch (err: any) {
            setError(err.message || 'Failed to create family group');
        } finally {
            setProcessing(false);
        }
    }

    async function handleJoinFamily() {
        if (!joinCode.trim()) {
            setError('Please enter an invite code');
            return;
        }

        setProcessing(true);
        setError(null);
        try {
            await joinFamilyGroup(joinCode.trim());
            await loadFamilyData();
            onFamilyStatusChange?.(true);
            setShowJoinForm(false);
            setJoinCode('');
        } catch (err: any) {
            setError(err.message || 'Failed to join family group');
        } finally {
            setProcessing(false);
        }
    }

    async function handleLeaveFamily() {
        if (!confirm('Are you sure you want to leave this family group? Your menus will become personal.')) {
            return;
        }

        setProcessing(true);
        setError(null);
        try {
            await leaveFamilyGroup();
            setFamilyGroup(null);
            setMembers([]);
            setCreditPool(null);
            setActivities([]);
            onFamilyStatusChange?.(false);
        } catch (err: any) {
            setError(err.message || 'Failed to leave family group');
        } finally {
            setProcessing(false);
        }
    }

    async function handleRegenerateCode() {
        if (!familyGroup) return;

        setProcessing(true);
        try {
            await regenerateInviteCode(familyGroup.id);
            await loadFamilyData();
        } catch (err: any) {
            setError(err.message || 'Failed to regenerate invite code');
        } finally {
            setProcessing(false);
        }
    }

    async function handleRemoveMember(userId: string) {
        if (!familyGroup) return;
        if (!confirm('Remove this member from the family group?')) return;

        setProcessing(true);
        try {
            await removeFamilyMember(familyGroup.id, userId);
            setMembers(members.filter(m => m.user_id !== userId));
        } catch (err: any) {
            setError(err.message || 'Failed to remove member');
        } finally {
            setProcessing(false);
        }
    }

    function handleCopyCode() {
        if (!familyGroup) return;
        navigator.clipboard.writeText(familyGroup.invite_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    async function handleShareLink() {
        if (!familyGroup) return;
        const link = generateInviteLink(familyGroup.invite_code);
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Join my family on Qook Commander!',
                    text: `Use this link to join our family meal planning group`,
                    url: link
                });
            } catch {
                navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } else {
            navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

    const isOwner = members.find(m => m.role === 'owner')?.user_id === familyGroup?.owner_id;

    // Activity icon mapping
    function getActivityIcon(type: FamilyActivity['action_type']) {
        switch (type) {
            case 'meal_added':
            case 'meal_edited':
            case 'meal_deleted':
                return <ChefHat className="w-4 h-4" />;
            case 'plan_generated':
                return <Calendar className="w-4 h-4" />;
            case 'grocery_generated':
                return <ShoppingCart className="w-4 h-4" />;
            case 'member_joined':
                return <UserPlus className="w-4 h-4" />;
            case 'member_left':
                return <UserMinus className="w-4 h-4" />;
            default:
                return <Clock className="w-4 h-4" />;
        }
    }

    function getActivityColor(type: FamilyActivity['action_type']) {
        switch (type) {
            case 'meal_added':
                return 'text-green-600 bg-green-50';
            case 'meal_edited':
                return 'text-blue-600 bg-blue-50';
            case 'meal_deleted':
                return 'text-red-600 bg-red-50';
            case 'plan_generated':
                return 'text-purple-600 bg-purple-50';
            case 'grocery_generated':
                return 'text-amber-600 bg-amber-50';
            case 'member_joined':
                return 'text-emerald-600 bg-emerald-50';
            case 'member_left':
                return 'text-gray-600 bg-gray-50';
            default:
                return 'text-gray-600 bg-gray-50';
        }
    }

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg p-8 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent"></div>
                </div>
            </div>
        );
    }

    // Not in a family - show creation/join options
    if (!familyGroup) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-orange-50 to-amber-50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <Users className="w-5 h-5 text-orange-600" />
                            </div>
                            <h3 className="font-bold text-gray-800">Family Mode</h3>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="text-center">
                            <p className="text-sm text-gray-500">
                                Plan meals together with your partner or family
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        {showJoinForm ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Enter Invite Code
                                    </label>
                                    <input
                                        type="text"
                                        value={joinCode}
                                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                        placeholder="FAM-XXXXXX"
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 text-center text-lg font-mono tracking-wider"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowJoinForm(false)}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleJoinFamily}
                                        disabled={processing}
                                        className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                        Join Family
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <button
                                    onClick={handleCreateFamily}
                                    disabled={processing}
                                    className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {processing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
                                    Create Family Group
                                </button>
                                <button
                                    onClick={() => setShowJoinForm(true)}
                                    className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg font-medium hover:border-orange-400 hover:text-orange-600 flex items-center justify-center gap-2"
                                >
                                    <Link2 className="w-5 h-5" />
                                    Join with Invite Code
                                </button>
                            </div>
                        )}

                        <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4 rounded-lg border border-orange-200">
                            <h4 className="font-medium text-orange-800 mb-2">✨ Family Mode Benefits</h4>
                            <ul className="text-sm text-orange-700 space-y-1">
                                <li>• Real-time collaborative meal planning</li>
                                <li>• Shared grocery lists</li>
                                <li>• See who made changes</li>
                                <li>• Combined credit pool</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // In a family - show management UI with activity log
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-orange-50 to-amber-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">{familyGroup.name}</h3>
                            <p className="text-sm text-gray-500">{members.length} member{members.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="p-5 space-y-5 overflow-y-auto flex-1">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Members Section */}
                    <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Members
                        </h4>
                        <div className="space-y-2">
                            {members.map((member) => (
                                <div
                                    key={member.id}
                                    className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white border rounded-full flex items-center justify-center">
                                            {member.role === 'owner' ? (
                                                <Crown className="w-5 h-5 text-amber-500" />
                                            ) : (
                                                <Users className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {member.display_name || 'Unknown'}
                                            </p>
                                            <p className="text-xs text-gray-500 capitalize">
                                                {member.role}
                                            </p>
                                        </div>
                                    </div>
                                    {isOwner && member.role !== 'owner' && (
                                        <button
                                            onClick={() => handleRemoveMember(member.user_id)}
                                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                            title="Remove member"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Invite Code Section */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700">Invite Code</span>
                            {isOwner && (
                                <button
                                    onClick={handleRegenerateCode}
                                    disabled={processing}
                                    className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Regenerate
                                </button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1 bg-white border rounded-lg px-4 py-2 font-mono text-lg tracking-wider text-center">
                                {familyGroup.invite_code}
                            </div>
                            <button
                                onClick={handleCopyCode}
                                className="px-3 py-2 bg-white border rounded-lg hover:bg-gray-50"
                                title="Copy code"
                            >
                                {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-gray-500" />}
                            </button>
                            <button
                                onClick={handleShareLink}
                                className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                                title="Share link"
                            >
                                <Share2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Activity Log Section */}
                    <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Recent Activity
                        </h4>
                        {activities.length === 0 ? (
                            <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-lg">
                                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                No activity yet. Start planning meals together!
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {activities.map((activity) => (
                                    <div
                                        key={activity.id}
                                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                                    >
                                        <div className={`p-2 rounded-lg ${getActivityColor(activity.action_type)}`}>
                                            {getActivityIcon(activity.action_type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-800">{activity.description}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {activity.user_name} • {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-100 shrink-0">
                    <button
                        onClick={handleLeaveFamily}
                        disabled={processing}
                        className="w-full py-3 border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <LogOut className="w-5 h-5" />
                        Leave Family Group
                    </button>
                </div>
            </div>
        </div>
    );
}
