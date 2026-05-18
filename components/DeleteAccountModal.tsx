import React, { useState } from 'react';
import { X, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getApiBaseUrl } from '../utils/platform';
import { supabase } from '../lib/supabase';

interface DeleteAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
    const { user, signOut } = useAuth();
    const [confirmText, setConfirmText] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const isConfirmed = confirmText.toUpperCase() === 'DELETE';

    const handleDelete = async () => {
        if (!isConfirmed || !user) return;

        setLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(`${getApiBaseUrl()}/api/delete-account`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                },
                body: JSON.stringify({
                    userId: user.id,
                    reason: reason || 'User requested deletion'
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to delete account');
            }

            // Success - sign out and redirect
            await signOut();
            window.location.href = '/';

        } catch (err: any) {
            setError(err.message || 'An error occurred while deleting your account');
            setLoading(false);
        }
    };

    return (
        <div className="app-modal-frame bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="app-modal-surface bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-red-600 p-5 text-white">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-6 h-6" />
                            <h2 className="text-xl font-bold">Delete Account</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                            disabled={loading}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">
                    {/* Warning */}
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <p className="text-red-800 text-sm font-medium mb-2">
                            ⚠️ This action cannot be undone
                        </p>
                        <ul className="text-red-700 text-sm space-y-1">
                            <li>• Your meal plans will be deleted</li>
                            <li>• Your preferences will be removed</li>
                            <li>• Your credits will be lost</li>
                            <li>• You can re-register with the same email for a fresh start</li>
                        </ul>
                    </div>

                    {/* Reason (optional) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Why are you leaving? (optional)
                        </label>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            disabled={loading}
                        >
                            <option value="">Select a reason...</option>
                            <option value="Not using the app">Not using the app</option>
                            <option value="Found a better alternative">Found a better alternative</option>
                            <option value="Too expensive">Too expensive</option>
                            <option value="Technical issues">Technical issues</option>
                            <option value="Privacy concerns">Privacy concerns</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    {/* Confirmation */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Type <span className="font-bold text-red-600">DELETE</span> to confirm
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="Type DELETE"
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-center font-mono text-lg tracking-widest"
                            disabled={loading}
                            autoComplete="off"
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-100 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={!isConfirmed || loading}
                            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-5 h-5" />
                                    Delete Account
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500 text-center">
                        Your data may be retained for legal and compliance purposes.
                        Re-registering with the same email will create a completely new account.
                    </p>
                </div>
            </div>
        </div>
    );
}
