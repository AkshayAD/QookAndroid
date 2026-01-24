import React, { useState } from 'react';
import { User, Globe, MessageSquare, Gift, Check, X, Loader2, Phone } from 'lucide-react';
import { OnboardingData } from '../../types';
import { validateReferralCode } from '../../services/referralService';

interface StepProps {
    data: OnboardingData;
    updateData: (updates: Partial<OnboardingData>) => void;
    onNext: () => void;
    isRerun?: boolean; // True if user is re-running setup wizard (not first time)
}

const COUNTRIES = [
    { code: 'India', flag: '🇮🇳', name: 'India' },
    { code: 'USA', flag: '🇺🇸', name: 'USA' },
    { code: 'UK', flag: '🇬🇧', name: 'UK' },
    { code: 'UAE', flag: '🇦🇪', name: 'UAE' },
    { code: 'Singapore', flag: '🇸🇬', name: 'Singapore' },
    { code: 'Canada', flag: '🇨🇦', name: 'Canada' },
];

const NameLocationStep: React.FC<StepProps> = ({ data, updateData, isRerun }) => {
    const [customCountry, setCustomCountry] = useState(
        !COUNTRIES.find(c => c.code === data.country) ? data.country : ''
    );
    const [referralInput, setReferralInput] = useState(data.referralCode || '');
    const [referralStatus, setReferralStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
    const [referralError, setReferralError] = useState('');
    const [phoneError, setPhoneError] = useState('');

    const handleCustomCountryChange = (value: string) => {
        setCustomCountry(value);
        if (value.trim()) {
            updateData({ country: value });
        }
    };

    const handleCountrySelect = (code: string) => {
        setCustomCountry(''); // Clear custom input when selecting predefined
        updateData({ country: code });
    };

    const validatePhoneNumber = (phone: string): { valid: boolean; error: string } => {
        const cleaned = phone.replace(/\D/g, '');
        const hasCountryCode = phone.startsWith('+');

        // Empty is valid (optional field)
        if (!phone.trim()) {
            return { valid: true, error: '' };
        }

        // Case 1: Exactly 10 digits (local format like 9876543210)
        if (cleaned.length === 10 && !hasCountryCode) {
            return { valid: true, error: '' };
        }

        // Case 2: 11 digits starting with 0 (e.g., 09876543210)
        if (cleaned.length === 11 && cleaned.startsWith('0')) {
            return { valid: true, error: '' };
        }

        // Case 3: Country code + 10 digits (e.g., +91 9876543210 = 12 digits)
        if (hasCountryCode && cleaned.length >= 11 && cleaned.length <= 14) {
            return { valid: true, error: '' };
        }

        return { valid: false, error: 'Enter 10-digit number or add country code (e.g., +91)' };
    };

    const handlePhoneChange = (value: string) => {
        updateData({ phone: value });
        const result = validatePhoneNumber(value);
        setPhoneError(result.error);
    };

    const handleReferralChange = async (value: string) => {
        const upperValue = value.toUpperCase();
        setReferralInput(upperValue);
        setReferralStatus('idle');
        setReferralError('');

        // Clear if empty
        if (!upperValue.trim()) {
            updateData({ referralCode: '' });
            return;
        }

        // Check format first (QOOK-XXXXXX)
        if (!/^QOOK-[A-Z0-9]{0,6}$/.test(upperValue)) {
            // Allow partial typing but don't validate yet
            if (upperValue.length >= 11) {
                setReferralStatus('invalid');
                setReferralError('Invalid code format');
            }
            return;
        }

        // Full code entered - validate with server
        if (upperValue.length === 11) {
            setReferralStatus('checking');
            const result = await validateReferralCode(upperValue);
            if (result.valid) {
                setReferralStatus('valid');
                updateData({ referralCode: upperValue });
            } else {
                setReferralStatus('invalid');
                setReferralError(result.error || 'Invalid code');
            }
        }
    };

    return (
        <div className="space-y-5">
            {/* Name Input */}
            <div>
                <label className="flex items-center gap-2 text-base font-bold text-gray-800 mb-2">
                    <User className="w-4 h-4 text-orange-500" />
                    What should I call you?
                </label>
                <input
                    type="text"
                    value={data.userName}
                    onChange={(e) => updateData({ userName: e.target.value })}
                    placeholder="Your name..."
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-base font-medium focus:border-orange-400 focus:ring-4 focus:ring-orange-100 outline-none transition-all"
                    autoFocus
                />
            </div>

            {/* Phone Input - for bonus credits */}
            <div>
                <label className="flex items-center gap-2 text-base font-bold text-gray-800 mb-2">
                    <Phone className="w-4 h-4 text-orange-500" />
                    Phone number
                    <span className="text-xs font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        +2 bonus credits
                    </span>
                </label>
                <input
                    type="tel"
                    value={data.phone || ''}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="+91 98765 43210"
                    className={`w-full px-4 py-3 bg-white border-2 rounded-xl text-base font-medium focus:ring-4 focus:ring-orange-100 outline-none transition-all ${phoneError ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-orange-400'
                        }`}
                />
                {phoneError ? (
                    <p className="text-xs text-red-500 mt-1">{phoneError}</p>
                ) : (
                    <p className="text-xs text-gray-500 mt-1">Optional - add for 2 bonus AI credits</p>
                )}
            </div>

            {/* Country Selection - Compact */}
            <div>
                <label className="flex items-center gap-2 text-base font-bold text-gray-800 mb-2">
                    <Globe className="w-4 h-4 text-orange-500" />
                    Where are you based?
                </label>
                <div className="grid grid-cols-3 gap-2">
                    {COUNTRIES.map((country) => (
                        <button
                            key={country.code}
                            onClick={() => handleCountrySelect(country.code)}
                            className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all ${data.country === country.code && !customCountry
                                ? 'border-orange-400 bg-orange-50 shadow-sm'
                                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            <span className="text-2xl">{country.flag}</span>
                            <span className={`text-xs font-medium ${data.country === country.code && !customCountry ? 'text-orange-700' : 'text-gray-600'
                                }`}>
                                {country.name}
                            </span>
                        </button>
                    ))}
                </div>
                {/* Other country input - Fixed behavior */}
                <input
                    type="text"
                    value={customCountry}
                    onChange={(e) => handleCustomCountryChange(e.target.value)}
                    placeholder="Or type your country..."
                    className="w-full mt-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-orange-400 outline-none"
                />
            </div>

            {/* Language Selection - Compact */}
            <div>
                <label className="flex items-center gap-2 text-base font-bold text-gray-800 mb-2">
                    <MessageSquare className="w-4 h-4 text-orange-500" />
                    Preferred language for menus?
                </label>
                <div className="flex gap-2">
                    {[
                        { code: 'English', label: 'English' },
                        { code: 'Hindi', label: 'हिंदी' },
                    ].map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => updateData({ language: lang.code as 'English' | 'Hindi' })}
                            className={`flex-1 py-3 px-4 rounded-xl border-2 font-semibold transition-all ${data.language === lang.code
                                ? 'border-orange-400 bg-orange-50 text-orange-700'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                }`}
                        >
                            {lang.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default NameLocationStep;

