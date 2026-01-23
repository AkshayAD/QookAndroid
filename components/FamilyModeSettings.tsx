/**
 * FamilyModeSettings Component
 * UI for managing family groups, members, and invitations
 */

import React, { useState, useEffect } from 'react';
import {
    Users,
    UserPlus,
    Link2,
    Copy,
    Check,
    Crown,
    LogOut,
    RefreshCw,
    Trash2,
    CreditCard,
    Share2
} from 'lucide-react';
import {
    FamilyGroup,
    FamilyMember,
    FamilyCreditPool,
    getUserFamilyGroup,
    createFamilyGroup,
    joinFamilyGroup,
    leaveFamilyGroup,
    getFamilyMembers,
    getFamilyCreditPool,
    regenerateInviteCode,
    removeFamilyMember,
    generateInviteLink,
    subscribeToFamilyGroup
} from '../services/familyService';

interface FamilyModeSettingsProps {
    onClose?: () => void;
    onFamilyStatusChange?: (isInFamily: boolean) => void;
}

export default function FamilyModeSettings({ onClose, onFamilyStatusChange }: FamilyModeSettingsProps) {
    const [loading, setLoading] = useState(true);
    const [familyGroup, setFamilyGroup] = useState<FamilyGroup | null>(null);
    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [creditPool, setCreditPool] = useState<FamilyCreditPool | null>(null);
    const [inviteCode, setInviteCode] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [showJoinForm, setShowJoinForm] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    // Load family data
    useEffect(() => {
        loadFamilyData();
    }, []);

    // Real-time subscription
    useEffect(() => {
        if (!familyGroup) return;

        const unsubscribe = subscribeToFamilyGroup(
            familyGroup.id,
            (newMembers) => setMembers(newMembers),
            (newPool) => setCreditPool(newPool)
        );

        return () => unsubscribe();
    }, [familyGroup?.id]);

    async function loadFamilyData() {
        setLoading(true);
        try {
            const group = await getUserFamilyGroup();
            setFamilyGroup(group);

            if (group) {
                setInviteCode(group.invite_code);
                const [memberList, pool] = await Promise.all([
                    getFamilyMembers(group.id),
                    getFamilyCreditPool(group.id)
                ]);
                setMembers(memberList);
                setCreditPool(pool);
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
            const result = await createFamilyGroup('My Family');
            if (result) {
                setInviteCode(result.inviteCode);
                await loadFamilyData();
                onFamilyStatusChange?.(true);
            }
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
            const newCode = await regenerateInviteCode(familyGroup.id);
            setInviteCode(newCode);
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

    function handleCopyLink() {
        const link = generateInviteLink(inviteCode);
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function handleCopyCode() {
        navigator.clipboard.writeText(inviteCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    async function handleShareLink() {
        const link = generateInviteLink(inviteCode);
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Join my family on Qook Commander!',
                    text: `Use this link to join our family meal planning group: ${inviteCode}`,
                    url: link
                });
            } catch (err) {
                // User cancelled or share failed
                handleCopyLink();
            }
        } else {
            handleCopyLink();
        }
    }

    const isOwner = members.find(m => m.role === 'owner')?.user_id === familyGroup?.owner_id;

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent"></div>
            </div>
        );
    }

    // Not in a family - show creation/join options
    if (!familyGroup) {
        return (
            <div className="space-y-6">
                <div className="text-center">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-orange-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Family Mode</h3>
                    <p className="text-sm text-gray-500 mt-1">
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
                                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-center text-lg font-mono tracking-wider"
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
                                {processing ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <UserPlus className="w-4 h-4" />
                                )}
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
                            {processing ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                                <Users className="w-5 h-5" />
                            )}
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
                        <li>• Combined credit pool</li>
                        <li>• See who made changes</li>
                    </ul>
                </div>
            </div>
        );
    }

    // In a family - show management UI
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">{familyGroup.name}</h3>
                        <p className="text-sm text-gray-500">{members.length} member{members.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
                {creditPool && (
                    <div className="text-right">
                        <div className="flex items-center gap-1 text-orange-600 font-semibold">
                            <CreditCard className="w-4 h-4" />
                            {creditPool.total_credits}
                        </div>
                        <p className="text-xs text-gray-500">Family Credits</p>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* Invite Section */}
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
                        {inviteCode}
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

            {/* Members List */}
            <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Members ({members.length})</h4>
                <div className="space-y-2">
                    {members.map((member) => (
                        <div
                            key={member.id}
                            className="flex items-center justify-between bg-white border rounded-lg p-3"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                    {member.role === 'owner' ? (
                                        <Crown className="w-5 h-5 text-amber-500" />
                                    ) : (
                                        <Users className="w-5 h-5 text-gray-400" />
                                    )}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">
                                        {member.display_name || 'Unknown'}
                                        {member.role === 'owner' && <span className="ml-1 text-xs text-amber-600">(Owner)</span>}
                                    </p>
                                    {member.email && (
                                        <p className="text-xs text-gray-600">{member.email}</p>
                                    )}
                                    <p className="text-xs text-gray-400">
                                        Joined {new Date(member.joined_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            {isOwner && member.role !== 'owner' && (
                                <button
                                    onClick={() => handleRemoveMember(member.user_id)}
                                    disabled={processing}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                    title="Remove member"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Leave Button */}
            <button
                onClick={handleLeaveFamily}
                disabled={processing}
                className="w-full py-3 border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
                <LogOut className="w-5 h-5" />
                Leave Family Group
            </button>
        </div>
    );
}
