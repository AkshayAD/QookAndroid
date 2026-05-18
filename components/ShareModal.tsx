import React, { useState, useEffect, useCallback } from 'react';
import { X, Share2, Download, Copy, Phone, Loader2, Globe, AlertCircle, MessageCircle, Check } from 'lucide-react';
import html2canvas from 'html2canvas';
import { format, parseISO } from 'date-fns';
import { WeeklyPlan, GroceryItem } from '../types';
import ShareableCard from './ShareableCard';
import { translateViaProxy } from '../services/aiProxyService';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useShareMenuTrustAction } from '../hooks/useTrustActions';
import { isNative } from '../utils/platform';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'plan' | 'grocery';
    data: WeeklyPlan | GroceryItem[];
    dateRange: string;
    sourceLanguage?: 'English' | 'Hindi'; // Language the data was generated in
    familyGroupId?: string | null;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, type, data, dateRange, sourceLanguage, familyGroupId }) => {
    const [loading, setLoading] = useState(false);
    const [translating, setTranslating] = useState(false);
    const [isTranslated, setIsTranslated] = useState(false);
    const [translatedData, setTranslatedData] = useState<WeeklyPlan | GroceryItem[] | null>(null);
    const [translationError, setTranslationError] = useState<string | null>(null);

    // Day selection for sharing (for meal plans)
    const [selectedDays, setSelectedDays] = useState<boolean[]>([true, true, true, true, true, true, true]);

    const { apiKey, modelName } = useSettings();
    const { user } = useAuth();
    const userId = user?.id || 'local';
    const awardShareMenu = useShareMenuTrustAction();
    // Remove strict config requirement for client-side service
    // const config: AIConfig = { apiKey, modelName };

    const cookName = localStorage.getItem('cook_name');
    const cookNumber = localStorage.getItem('cook_number');

    // Detect if original data is in Hindi (by checking for Devanagari characters)
    const detectOriginalLanguage = useCallback((): 'hi' | 'en' => {
        if (sourceLanguage === 'Hindi') return 'hi';
        if (sourceLanguage === 'English') return 'en';

        // Auto-detect from content
        if (type === 'plan') {
            const planData = data as WeeklyPlan;
            const sampleText = planData.days.map(d => `${d.breakfast} ${d.lunch} ${d.dinner}`).join(' ');
            return /[\u0900-\u097F]/.test(sampleText) ? 'hi' : 'en';
        } else {
            const groceryData = data as GroceryItem[];
            const sampleText = groceryData.map(i => i.item).join(' ');
            return /[\u0900-\u097F]/.test(sampleText) ? 'hi' : 'en';
        }
    }, [data, type, sourceLanguage]);

    const [originalLanguage, setOriginalLanguage] = useState<'hi' | 'en'>('en');

    // Determine original language on mount/data change
    useEffect(() => {
        setOriginalLanguage(detectOriginalLanguage());
    }, [detectOriginalLanguage]);

    // Reset translation when modal opens/closes or data changes
    useEffect(() => {
        setTranslatedData(null);
        setIsTranslated(false);
        setTranslationError(null);
    }, [isOpen, data]);

    // Current display language
    const currentDisplayLanguage = isTranslated
        ? (originalLanguage === 'hi' ? 'en' : 'hi')
        : originalLanguage;

    // Handle language toggle with AI translation
    const handleLanguageToggle = useCallback(async () => {
        if (isTranslated) {
            // Switch back to original - use original data
            setIsTranslated(false);
            setTranslatedData(null);
            setTranslationError(null);
            return;
        }

        // Check for API key before translating
        // Proxy migration: Strict check removed. Proxy will handle credits or API key validation.
        /*
        if (!apiKey) {
            setTranslationError('API key required for translation. Please add it in Settings.');
            return;
        }
        */

        // Translate to the other language
        const targetLanguage = originalLanguage === 'hi' ? 'en' : 'hi';

        setTranslating(true);
        setTranslationError(null);

        try {
            // Use Proxy for Translation (Charged)
            if (type === 'plan') {
                const planData = data as WeeklyPlan;
                const translated = await translateViaProxy(userId, planData, targetLanguage, 'plan', familyGroupId, apiKey || undefined);
                setTranslatedData({ days: translated.days });
            } else {
                const groceryData = data as GroceryItem[];
                const itemsForTranslation = groceryData.map(item => ({
                    item: item.item,
                    quantity: item.quantity,
                    category: item.category,
                    checked: item.checked
                }));
                const translated = await translateViaProxy(userId, itemsForTranslation, targetLanguage, 'grocery', familyGroupId, apiKey || undefined);
                // Map back to GroceryItems
                setTranslatedData(translated.map((t: any, i: number) => ({
                    ...groceryData[i],
                    item: t.item,
                    quantity: t.quantity,
                    category: t.category
                })));
            }
            setIsTranslated(true);
        } catch (error: any) {
            console.error('Translation failed:', error);
            setTranslationError(error.message || 'Translation failed. Please try again.');
        } finally {
            setTranslating(false);
        }
    }, [isTranslated, apiKey, type, data, originalLanguage, userId, familyGroupId]);

    if (!isOpen) return null;

    // Use translated data if available, otherwise original
    const baseData = isTranslated && translatedData ? translatedData : data;

    // Filter days based on selection (for meal plans only)
    const displayData = type === 'plan' && Array.isArray(selectedDays)
        ? { days: (baseData as WeeklyPlan).days.filter((_, idx) => selectedDays[idx]) }
        : baseData;

    // Calculate the display date range based on selected days
    const getDisplayDateRange = () => {
        const planData = type === 'plan' ? (baseData as WeeklyPlan) : null;

        // Format a date string like "2026-01-18" to "Sat, 18-Jan"
        const formatDay = (day: string) => {
            if (!day) return '';
            // If it's ISO format (2026-01-18), parse and format
            if (day.match(/^\d{4}-\d{2}-\d{2}$/)) {
                try {
                    return format(parseISO(day), 'EEE, d-MMM');
                } catch { return day; }
            }
            // Already formatted or other format
            return day;
        };

        // For grocery lists or if no plan data, format the dateRange directly
        if (type !== 'plan' || !planData?.days) {
            // Try to format dateRange if it looks like a date
            if (dateRange.match(/^\d{4}-\d{2}-\d{2}/)) {
                const parts = dateRange.split(' - ');
                if (parts.length === 2) {
                    return `${formatDay(parts[0].trim())} to ${formatDay(parts[1].trim())}`;
                }
                return formatDay(dateRange);
            }
            return dateRange;
        }

        const selectedIndices = selectedDays.map((s, i) => s ? i : -1).filter(i => i >= 0);
        if (selectedIndices.length === 0) {
            // No days selected - use first and last from plan
            const firstDay = planData.days[0]?.day || '';
            const lastDay = planData.days[planData.days.length - 1]?.day || '';
            return `${formatDay(firstDay)} to ${formatDay(lastDay)}`;
        }

        const firstIdx = selectedIndices[0];
        const lastIdx = selectedIndices[selectedIndices.length - 1];
        const firstDayRaw = planData.days[firstIdx]?.day || '';
        const lastDayRaw = planData.days[lastIdx]?.day || '';

        const firstDay = formatDay(firstDayRaw);
        const lastDay = formatDay(lastDayRaw);

        if (firstDay === lastDay) return firstDay;
        return `${firstDay} to ${lastDay}`;
    };

    const displayDateRange = getDisplayDateRange();

    // Helper: Convert blob to base64
    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    // Helper: Save image to cache and get file path for native sharing
    const saveImageToCache = async (blob: Blob, filename: string): Promise<string | null> => {
        try {
            const base64Data = await blobToBase64(blob);
            const result = await Filesystem.writeFile({
                path: filename,
                data: base64Data,
                directory: Directory.Cache,
            });
            return result.uri;
        } catch (error) {
            console.error('Failed to save image to cache:', error);
            return null;
        }
    };

    // Direct WhatsApp share - uses native Capacitor Share on Android
    const handleWhatsAppShare = async () => {
        setLoading(true);
        const blob = await generateImage();
        if (!blob) {
            setLoading(false);
            return;
        }

        const filename = `qook-${type}-${displayDateRange.replace(/\\s/g, '-')}.png`;
        const shareText = `${type === 'plan' ? '🍽️ Menu' : '🛒 Grocery List'} for ${displayDateRange}\n\nMade with ❤️ by QookCommander\nqook.in`;

        // Use Capacitor native share on Android
        if (isNative()) {
            try {
                const fileUri = await saveImageToCache(blob, filename);
                if (fileUri) {
                    await Share.share({
                        title: type === 'plan' ? 'Weekly Meal Plan' : 'Grocery List',
                        text: shareText,
                        files: [fileUri],
                        dialogTitle: 'Share via',
                    });
                    awardShareMenu();
                }
            } catch (e: any) {
                console.log('Native share cancelled or failed:', e);
            }
            setLoading(false);
            return;
        }

        // Web fallback: Try Web Share API first
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.share && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: type === 'plan' ? 'Weekly Meal Plan' : 'Grocery List',
                    text: shareText
                });
                awardShareMenu();
                setLoading(false);
                return;
            } catch (e) {
                setLoading(false);
                return;
            }
        }

        // Desktop fallback: Download image and open WhatsApp web
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        const text = encodeURIComponent(`${type === 'plan' ? '🍽️ Menu' : '🛒 Grocery List'} for ${displayDateRange}\n\n📎 Attach the downloaded image\n\nMade with ❤️ by QookCommander\nqook.in`);
        window.open(`https://wa.me/?text=${text}`, '_blank');

        awardShareMenu();
        setLoading(false);
    };



    const generateImage = async (): Promise<Blob | null> => {
        const element = document.getElementById('share-capture-container');
        if (!element) return null;

        try {
            const canvas = await html2canvas(element, {
                scale: 3, // HD quality for WhatsApp
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
            });
            return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        } catch (err) {
            console.error('Image generation failed', err);
            return null;
        }
    };

    const handleNativeShare = async () => {
        setLoading(true);
        const blob = await generateImage();
        if (!blob) {
            setLoading(false);
            return;
        }

        const filename = `qookcommander-${type}-${dateRange.replace(/\\s/g, '-')}.png`;
        const shareText = `${type === 'plan' ? '🍽️ Menu' : '🛒 Grocery List'} for ${displayDateRange}\n\nMade with ❤️ by QookCommander\nqook.in`;

        // Use Capacitor native share on Android
        if (isNative()) {
            try {
                const fileUri = await saveImageToCache(blob, filename);
                if (fileUri) {
                    await Share.share({
                        title: 'QookCommander Plan',
                        text: shareText,
                        files: [fileUri],
                        dialogTitle: 'Share via',
                    });
                    awardShareMenu();
                }
            } catch (e: any) {
                console.log('Native share cancelled or failed:', e);
            }
            setLoading(false);
            return;
        }

        // Web fallback
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.share && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'QookCommander Plan',
                    text: shareText
                });
                awardShareMenu();
            } catch (err) {
                console.log('Share cancelled or failed', err);
            }
        } else {
            alert('Native sharing not supported on this device. Please use Download or Copy.');
        }
        setLoading(false);
    };

    const handleDownload = async () => {
        setLoading(true);
        const blob = await generateImage();
        if (!blob) {
            setLoading(false);
            return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `qookcommander-${type}-${dateRange.replace(/\s/g, '-')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setLoading(false);
    };

    const handleCopy = async () => {
        setLoading(true);
        const blob = await generateImage();
        if (!blob) {
            setLoading(false);
            return;
        }

        try {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            alert('Image copied to clipboard!');
        } catch (err) {
            alert('Failed to copy image. Browser may not support it.');
        }
        setLoading(false);
    };

    const handleSendToCook = async () => {
        if (!cookNumber) {
            alert("Please set Cook's number in Settings first.");
            return;
        }

        setLoading(true);
        const blob = await generateImage();
        if (!blob) {
            setLoading(false);
            return;
        }

        const filename = `qook-${type}-for-cook.png`;
        const shareText = `Hi ${cookName || 'Chef'} 👋\n\nHere's the ${type === 'plan' ? 'menu' : 'grocery list'} for ${displayDateRange}\n\nMade with ❤️ by QookCommander\nqook.in`;

        // Use Capacitor native share on Android
        if (isNative()) {
            try {
                const fileUri = await saveImageToCache(blob, filename);
                if (fileUri) {
                    await Share.share({
                        title: 'For Cook',
                        text: shareText,
                        files: [fileUri],
                        dialogTitle: 'Send to Cook via',
                    });
                    awardShareMenu();
                }
            } catch (e: any) {
                console.log('Native share cancelled or failed:', e);
            }
            setLoading(false);
            return;
        }

        // Web fallback
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.share && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'For Cook',
                    text: shareText
                });
                awardShareMenu();
                setLoading(false);
                return;
            } catch (e) {
                // Fallthrough if cancelled or failed
            }
        }

        // Desktop fallback: Download image and open WhatsApp
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        const text = encodeURIComponent(`Hi ${cookName || 'Chef'} 👋\n\nHere's the ${type === 'plan' ? 'menu' : 'grocery list'} for ${displayDateRange}\n\n📎 Attaching image...\n\nMade with ❤️ by QookCommander\nqook.in`);
        window.open(`https://wa.me/${cookNumber}?text=${text}`, '_blank');
        awardShareMenu();
        setLoading(false);
    };

    return (
        <>
            {/* Hidden Capture Element */}
            <div
                className="fixed -left-[9999px] top-0 pointer-events-none"
                aria-hidden="true"
            >
                <div id="share-capture-container">
                    <ShareableCard type={type} data={displayData} dateRange={displayDateRange} forCapture={true} language={currentDisplayLanguage} />
                </div>
            </div>

            {/* Visible Modal */}
            <div className="app-modal-frame bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
                <div className="app-modal-surface bg-white rounded-2xl w-full max-w-lg sm:max-w-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[90vh]">

                    {/* Header with Close Button */}
                    <div className="p-3 sm:p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl shrink-0">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                            <Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                            Share {type === 'plan' ? 'Meal Plan' : 'Grocery List'}
                        </h3>

                        {/* Language Toggle + Close Button */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleLanguageToggle}
                                disabled={translating}
                                aria-label={isTranslated ? 'Show original language' : (originalLanguage === 'hi' ? 'Translate to English' : 'Translate to Hindi')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${translating
                                    ? 'bg-gray-100 text-gray-400 cursor-wait'
                                    : isTranslated
                                        ? 'bg-orange-100 text-orange-700 border border-orange-200'
                                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                    }`}
                                title={isTranslated ? 'Show original language' : (originalLanguage === 'hi' ? 'Translate to English' : 'Translate to Hindi')}
                            >
                                {translating ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Globe className="w-3.5 h-3.5" />
                                )}
                                {translating
                                    ? 'Translating...'
                                    : isTranslated
                                        ? (originalLanguage === 'hi' ? 'English ✓' : 'हिंदी ✓')
                                        : (originalLanguage === 'hi' ? 'English में' : 'हिंदी में')
                                }
                            </button>

                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="p-1.5 sm:p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                                title="Close"
                            >
                                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Translation Error */}
                    {translationError && (
                        <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2 text-red-600 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{translationError}</span>
                        </div>
                    )}

                    {/* Day Selection (for meal plans only) */}
                    {type === 'plan' && (data as WeeklyPlan).days && (
                        <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-semibold text-gray-700">Select days to share:</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {/* All Week toggle */}
                                <button
                                    onClick={() => setSelectedDays(selectedDays.every(s => s) ? [false, false, false, false, false, false, false] : [true, true, true, true, true, true, true])}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${selectedDays.every(s => s)
                                        ? 'bg-orange-500 text-white'
                                        : 'bg-white text-gray-600 border border-gray-200'
                                        }`}
                                >
                                    All Week
                                </button>
                                {/* Individual days */}
                                {(data as WeeklyPlan).days.map((day, idx) => {
                                    // Format day name like "Sun, 18-Jan"
                                    const dayLabel = day.day && day.day.includes('-')
                                        ? format(parseISO(day.day), 'EEE, d-MMM')
                                        : day.day?.split(',')[0] || `Day ${idx + 1}`;
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                const newSelected = [...selectedDays];
                                                newSelected[idx] = !newSelected[idx];
                                                setSelectedDays(newSelected);
                                            }}
                                            className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${selectedDays[idx]
                                                ? 'bg-orange-100 text-orange-700 border border-orange-300'
                                                : 'bg-white text-gray-500 border border-gray-200'
                                                }`}
                                        >
                                            {selectedDays[idx] && <Check className="w-3 h-3" />}
                                            {dayLabel}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Scrollable Content Area */}
                    <div
                        className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 bg-gray-100 overscroll-contain"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                        <div className="shadow-2xl rounded-sm overflow-visible mx-auto max-w-[500px]">
                            <ShareableCard type={type} data={displayData} dateRange={displayDateRange} forCapture={false} language={currentDisplayLanguage} />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-3 sm:p-6 border-t border-gray-100 bg-white rounded-b-2xl space-y-3 shrink-0 safe-area-inset-bottom">

                        {cookNumber && (
                            <button
                                onClick={handleSendToCook}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-md mb-2 text-sm sm:text-base min-h-[48px]"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Phone className="w-5 h-5" />}
                                Send to {cookName || "Cook"} (WhatsApp)
                            </button>
                        )}

                        {/* WhatsApp Share Button */}
                        <button
                            onClick={handleWhatsAppShare}
                            disabled={loading}
                            className="w-full flex flex-col items-center justify-center gap-1 px-4 py-3 bg-[#25D366] text-white rounded-xl font-bold hover:bg-[#1DA851] transition-all shadow-md min-h-[48px]"
                        >
                            <span className="flex items-center gap-2 text-sm sm:text-base">
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
                                Share on WhatsApp
                            </span>
                            <span className="text-[10px] font-normal opacity-80">💡 Tip: Choose HD quality when sharing</span>
                        </button>

                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            <button
                                onClick={handleNativeShare}
                                disabled={loading}
                                className="flex flex-col items-center justify-center p-2.5 sm:p-3 gap-1.5 sm:gap-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-700 transition-colors border border-gray-200 min-h-[60px] sm:min-h-[72px]"
                            >
                                <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="text-[10px] sm:text-xs font-medium">Share</span>
                            </button>

                            <button
                                onClick={handleCopy}
                                disabled={loading}
                                className="flex flex-col items-center justify-center p-2.5 sm:p-3 gap-1.5 sm:gap-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-700 transition-colors border border-gray-200 min-h-[60px] sm:min-h-[72px]"
                            >
                                <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="text-[10px] sm:text-xs font-medium">Copy</span>
                            </button>

                            <button
                                onClick={handleDownload}
                                disabled={loading}
                                className="flex flex-col items-center justify-center p-2.5 sm:p-3 gap-1.5 sm:gap-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-700 transition-colors border border-gray-200 min-h-[60px] sm:min-h-[72px]"
                            >
                                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="text-[10px] sm:text-xs font-medium">Download</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ShareModal;
