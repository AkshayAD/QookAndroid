/**
 * JoinFamilyPage
 * Handles invite link for joining a family group
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { joinFamilyGroup, getUserFamilyGroup } from '../services/familyService';
import { Users, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';

export default function JoinFamilyPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();

    const [status, setStatus] = useState<'loading' | 'ready' | 'joining' | 'success' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);
    const inviteCode = searchParams.get('code') || '';

    useEffect(() => {
        if (authLoading) return;

        if (!inviteCode) {
            setError('No invite code provided');
            setStatus('error');
            return;
        }

        // Check if already in a family group
        async function checkExistingFamily() {
            try {
                const existingGroup = await getUserFamilyGroup();
                if (existingGroup) {
                    setError('You are already in a family group. Leave your current group first to join another.');
                    setStatus('error');
                    return;
                }
                setStatus('ready');
            } catch (err) {
                setStatus('ready');
            }
        }

        if (user) {
            checkExistingFamily();
        } else {
            setStatus('ready');
        }
    }, [user, authLoading, inviteCode]);

    async function handleJoin() {
        if (!user) {
            // Store invite code and redirect to login
            localStorage.setItem('pendingFamilyInvite', inviteCode);
            navigate('/?action=login');
            return;
        }

        setStatus('joining');
        setError(null);

        try {
            await joinFamilyGroup(inviteCode);
            setStatus('success');
            // Redirect to dashboard after a short delay
            setTimeout(() => {
                navigate('/dashboard');
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Failed to join family group');
            setStatus('error');
        }
    }

    return (
        <div className="app-safe-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Join Family Group</h1>
                    <p className="text-gray-500 mt-2">
                        You've been invited to collaborate on meal planning
                    </p>
                </div>

                {/* Invite Code Display */}
                {inviteCode && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-6 text-center">
                        <p className="text-sm text-gray-500 mb-1">Invite Code</p>
                        <p className="font-mono text-2xl font-bold text-gray-900 tracking-wider">
                            {inviteCode}
                        </p>
                    </div>
                )}

                {/* Status Display */}
                {status === 'loading' && (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent"></div>
                    </div>
                )}

                {status === 'success' && (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-green-500" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to the family!</h2>
                        <p className="text-gray-500">Redirecting to your dashboard...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="mb-6">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-red-700 font-medium">Unable to join</p>
                                    <p className="text-red-600 text-sm mt-1">{error}</p>
                                </div>
                            </div>

                            {/* Context-aware resolution actions */}
                            {error?.includes('already') && (
                                <div className="mt-4 pt-4 border-t border-red-200">
                                    <p className="text-sm text-gray-600 mb-3">
                                        To join this family, you need to leave your current one first:
                                    </p>
                                    <button
                                        onClick={() => navigate('/dashboard')}
                                        className="w-full py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 flex items-center justify-center gap-2"
                                    >
                                        <Users className="w-4 h-4" />
                                        Go to Settings → Leave Family
                                    </button>
                                </div>
                            )}

                            {error?.includes('Invalid') && (
                                <div className="mt-4 pt-4 border-t border-red-200">
                                    <p className="text-sm text-gray-600 mb-3">
                                        The invite code may have expired or been changed. Ask the family owner for a new code.
                                    </p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => navigate('/')}
                            className="w-full mt-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                        >
                            Go to Home
                        </button>
                    </div>
                )}

                {status === 'ready' && (
                    <>
                        {/* Benefits */}
                        <div className="space-y-3 mb-6">
                            <div className="flex items-center gap-3 text-gray-600">
                                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                                    <span className="text-orange-600">🍽️</span>
                                </div>
                                <span>Collaborate on weekly meal plans</span>
                            </div>
                            <div className="flex items-center gap-3 text-gray-600">
                                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                                    <span className="text-orange-600">🛒</span>
                                </div>
                                <span>Share grocery lists automatically</span>
                            </div>
                            <div className="flex items-center gap-3 text-gray-600">
                                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                                    <span className="text-orange-600">⚡</span>
                                </div>
                                <span>See changes in real-time</span>
                            </div>
                        </div>

                        {/* Join Button */}
                        <button
                            onClick={handleJoin}
                            className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {user ? 'Join Family Group' : 'Sign In to Join'}
                            <ArrowRight className="w-5 h-5" />
                        </button>

                        {!user && (
                            <p className="text-center text-sm text-gray-500 mt-4">
                                You'll be asked to sign in first
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
