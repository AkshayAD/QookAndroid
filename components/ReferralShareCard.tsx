import React, { useState, useEffect } from 'react';
import { Gift, Copy, Check, Share2, Users, Sparkles, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getReferralStats, generateWhatsAppShareLink } from '../services/referralService';

interface ReferralStats {
    referralCode: string | null;
    totalReferrals: number;
    activeReferrals: number;
    pendingReferrals: number;
    creditsEarned: number;
    monthlyReferrals: number;
    monthlyLimit: number;
}

export default function ReferralShareCard() {
    const { user } = useAuth();
    const [stats, setStats] = useState<ReferralStats | null>(null);
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            loadStats();
        }
    }, [user?.id]);

    const loadStats = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const data = await getReferralStats(user.id);
            setStats(data);
        } catch (error) {
            console.error('Error loading referral stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = async () => {
        if (!stats?.referralCode) return;
        const link = `https://qook.in?ref=${stats.referralCode}`;
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    const handleWhatsAppShare = () => {
        if (!stats?.referralCode) return;
        const userName = user?.user_metadata?.full_name || user?.user_metadata?.name;
        const whatsappUrl = generateWhatsAppShareLink(stats.referralCode, userName);
        window.open(whatsappUrl, '_blank');
    };

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200 animate-pulse">
                <div className="h-6 bg-green-200 rounded w-1/3 mb-4"></div>
                <div className="h-10 bg-green-200 rounded mb-4"></div>
                <div className="h-10 bg-green-200 rounded"></div>
            </div>
        );
    }

    if (!stats?.referralCode) {
        return null;
    }

    return (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white">
                    <Gift className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900">Invite Friends, Earn Credits</h3>
                    <p className="text-sm text-gray-600">Both of you get 3 free credits!</p>
                </div>
            </div>

            {/* Referral Link Display */}
            <div className="bg-white rounded-xl p-4 mb-4 border border-green-200">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Your Referral Link</label>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium text-green-600 break-all flex-1">
                        qook.in?ref={stats.referralCode}
                    </span>
                    <button
                        onClick={handleCopyLink}
                        className="p-2 rounded-lg hover:bg-green-100 transition-colors shrink-0"
                        title="Copy link"
                    >
                        {copied ? (
                            <Check className="w-5 h-5 text-green-600" />
                        ) : (
                            <Copy className="w-5 h-5 text-gray-500" />
                        )}
                    </button>
                </div>
            </div>

            {/* Share Buttons */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={handleWhatsAppShare}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    Share via WhatsApp
                </button>
                <button
                    onClick={handleCopyLink}
                    className="p-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2"
                    title="Copy link"
                >
                    <Share2 className="w-5 h-5" />
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white/60 rounded-lg py-2 px-3">
                    <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                        <Users className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-lg font-bold text-gray-900">{stats.totalReferrals}</div>
                    <div className="text-xs text-gray-500">Referrals</div>
                </div>
                <div className="bg-white/60 rounded-lg py-2 px-3">
                    <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                        <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-lg font-bold text-green-600">{stats.creditsEarned}</div>
                    <div className="text-xs text-gray-500">Credits Earned</div>
                </div>
                <div className="bg-white/60 rounded-lg py-2 px-3">
                    <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-lg font-bold text-gray-900">{stats.monthlyReferrals}/{stats.monthlyLimit}</div>
                    <div className="text-xs text-gray-500">This Month</div>
                </div>
            </div>

            {/* Monthly limit warning */}
            {stats.monthlyReferrals >= stats.monthlyLimit && (
                <div className="mt-3 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                    You've reached your monthly limit. Rewards resume next month!
                </div>
            )}
        </div>
    );
}
