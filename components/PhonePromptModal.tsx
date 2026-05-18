/**
 * Phone Prompt Modal
 * 
 * Prompts the user to add their phone number for +2 credits.
 * Uses trust-based verification (no OTP required).
 */

import React, { useEffect, useState } from 'react';
import { Phone, Gift, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { completeTrustAction, hashPhoneNumber } from '../services/trustActions';
import { supabase } from '../lib/supabase';

interface PhonePromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (creditsAwarded: number) => void | Promise<void>;
}

export default function PhonePromptModal({ isOpen, onClose, onSuccess }: PhonePromptModalProps) {
    const { user } = useAuth();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setPhone('');
            setError('');
            setLoading(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    function emitTrustRefreshEvents() {
        window.dispatchEvent(new CustomEvent('trust-actions-updated'));
        window.dispatchEvent(new CustomEvent('refresh-credits'));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!user) return;

        // Basic validation
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length !== 10) {
            setError('Please enter a valid 10-digit phone number');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Hash the phone number for storage (privacy)
            const phoneHash = await hashPhoneNumber(cleaned);

            // Check if phone already used by another account
            const { data: existing, error: existingError } = await supabase
                .from('user_profiles')
                .select('id')
                .eq('phone_hash', phoneHash)
                .neq('id', user.id)
                .limit(1)
                .maybeSingle();

            if (existingError) {
                throw existingError;
            }

            if (existing) {
                setError('This phone number is already linked to another account');
                return;
            }

            const { error: profileError } = await supabase
                .from('user_profiles')
                .upsert({
                    id: user.id,
                    phone: cleaned,
                    phone_hash: phoneHash
                }, { onConflict: 'id' });

            if (profileError) {
                throw profileError;
            }

            // Award trust credits
            const result = await completeTrustAction(user.id, 'add_phone', { phone: cleaned });

            if (result.creditsAwarded > 0) {
                setLoading(false);
                emitTrustRefreshEvents();
                onClose();
                void Promise.resolve(onSuccess?.(result.creditsAwarded)).catch((callbackError) => {
                    console.error('Failed to refresh phone reward UI:', callbackError);
                });
                return;
            }

            setLoading(false);
            onClose();
        } catch (err) {
            console.error('Failed to save phone:', err);
            setError('Failed to save phone number. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="app-modal-frame bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="app-modal-surface bg-white rounded-2xl max-w-md w-full shadow-xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-yellow-500 p-6 rounded-t-2xl text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <Gift className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Unlock +2 Credits</h2>
                            <p className="text-sm text-white/80">Just add your phone number</p>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6">
                    <p className="text-sm text-gray-600 mb-4">
                        Add your phone number to earn <strong className="text-orange-600">2 extra credits</strong>.
                        No verification needed - we trust you!
                    </p>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone Number
                        </label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+91 98765 43210"
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                autoFocus
                            />
                        </div>
                        {error && (
                            <p className="mt-1 text-sm text-red-500">{error}</p>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        >
                            Maybe Later
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !phone}
                            className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                'Adding...'
                            ) : (
                                <>
                                    <Gift className="w-4 h-4" />
                                    Claim +2 Credits
                                </>
                            )}
                        </button>
                    </div>

                    <p className="mt-4 text-xs text-gray-400 text-center">
                        Your phone number is kept private and only used to prevent abuse.
                    </p>
                </form>
            </div>
        </div>
    );
}
