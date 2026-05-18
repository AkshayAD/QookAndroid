import React, { useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Package2, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { InventoryItem, InventorySource } from '../types';
import { getApiBaseUrl, isNative } from '../utils/platform';

interface DraftInventoryItem {
    name: string;
    source: InventorySource;
    confidence?: number;
}

interface InventoryCaptureModalProps {
    isOpen: boolean;
    title?: string;
    description?: string;
    existingItems: InventoryItem[];
    onClose: () => void;
    onAddItems: (items: DraftInventoryItem[]) => Promise<void>;
    onRemoveItem: (id: string) => Promise<void>;
    onSkip?: () => void;
    ctaLabel?: string;
}

function parseManualItems(input: string): string[] {
    return Array.from(
        new Set(
            input
                .split(/\n|,/g)
                .map((value) => value.trim())
                .filter(Boolean)
        )
    );
}

export default function InventoryCaptureModal({
    isOpen,
    title = 'Add What You Already Have',
    description = 'Capture your fridge, pantry, receipt, or order so Qook can use what is already in your kitchen.',
    existingItems,
    onClose,
    onAddItems,
    onRemoveItem,
    onSkip,
    ctaLabel = 'Save to What I Have',
}: InventoryCaptureModalProps) {
    const [manualInput, setManualInput] = useState('');
    const [draftItems, setDraftItems] = useState<DraftInventoryItem[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const captureInputRef = useRef<HTMLInputElement | null>(null);

    const existingNames = useMemo(
        () => new Set(existingItems.map((item) => item.name.toLowerCase())),
        [existingItems]
    );

    const mergedDraftItems = useMemo(() => (
        draftItems.filter((item, index, list) => (
            !existingNames.has(item.name.toLowerCase())
            && list.findIndex((entry) => entry.name.toLowerCase() === item.name.toLowerCase()) === index
        ))
    ), [draftItems, existingNames]);

    if (!isOpen) {
        return null;
    }

    const addDraftItems = (items: DraftInventoryItem[]) => {
        setDraftItems((previous) => [...previous, ...items]);
    };

    const analyzeImage = async (base64Data: string, imageType: string, source: InventorySource) => {
        setIsAnalyzing(true);
        setError(null);

        try {
            const response = await fetch(`${getApiBaseUrl()}/api/grocery-vision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageData: base64Data,
                    imageType,
                }),
            });

            const result = await response.json();
            if (!result.success || !Array.isArray(result.groceries)) {
                throw new Error(result.error || 'No items detected. Try a clearer photo.');
            }

            const detectedItems = result.groceries
                .map((item: any) => item.item)
                .filter(Boolean)
                .map((name: string) => ({
                    name,
                    source,
                    confidence: 0.86,
                }));

            addDraftItems(detectedItems);
        } catch (captureError: any) {
            setError(captureError?.message || 'Failed to analyze that photo.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleNativeCapture = async (source: CameraSource, inventorySource: InventorySource) => {
        try {
            const photo = await CapacitorCamera.getPhoto({
                quality: 85,
                resultType: CameraResultType.Base64,
                source,
                allowEditing: false,
            });

            if (photo.base64String) {
                await analyzeImage(photo.base64String, `image/${photo.format || 'jpeg'}`, inventorySource);
            }
        } catch (captureError: any) {
            if (!String(captureError?.message || '').toLowerCase().includes('cancel')) {
                setError('Unable to open camera right now.');
            }
        }
    };

    const handleFileUpload = async (file: File | undefined, source: InventorySource) => {
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            const dataUrl = String(reader.result || '');
            const base64 = dataUrl.split(',')[1];
            if (base64) {
                await analyzeImage(base64, file.type || 'image/jpeg', source);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        const manualItems = parseManualItems(manualInput).map((name) => ({
            name,
            source: 'manual' as InventorySource,
            confidence: 0.72,
        }));

        const payload = [...mergedDraftItems, ...manualItems].filter((item, index, list) => (
            list.findIndex((entry) => entry.name.toLowerCase() === item.name.toLowerCase()) === index
        ));

        if (payload.length === 0) {
            onClose();
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            await onAddItems(payload);
            setManualInput('');
            setDraftItems([]);
            onClose();
        } catch (saveError: any) {
            setError(saveError?.message || 'Failed to save your inventory.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveDraft = (name: string) => {
        setDraftItems((previous) => previous.filter((item) => item.name !== name));
    };

    return (
        <div className="app-modal-frame z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="app-modal-surface bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
                <div className="px-6 py-5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white flex items-start justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Planner Memory</p>
                        <h2 className="text-2xl font-bold mt-1">{title}</h2>
                        <p className="text-sm text-white/80 mt-2 max-w-xl">{description}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/15 rounded-full transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                        <button
                            onClick={() => (
                                isNative()
                                    ? handleNativeCapture(CameraSource.Camera, 'fridge_photo')
                                    : captureInputRef.current?.click()
                            )}
                            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left hover:bg-emerald-100 transition-colors"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-11 h-11 rounded-2xl bg-white text-emerald-600 flex items-center justify-center shadow-sm">
                                    {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                                </div>
                                <div>
                                    <p className="font-semibold text-emerald-900">Take a fridge photo</p>
                                    <p className="text-sm text-emerald-700">Surface ingredients for the next plan</p>
                                </div>
                            </div>
                            <p className="text-xs text-emerald-700/80">Best for fridge shelves, pantry baskets, or kitchen counters.</p>
                        </button>

                        <button
                            onClick={() => (
                                isNative()
                                    ? handleNativeCapture(CameraSource.Photos, 'receipt')
                                    : fileInputRef.current?.click()
                            )}
                            className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-left hover:bg-sky-100 transition-colors"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-11 h-11 rounded-2xl bg-white text-sky-600 flex items-center justify-center shadow-sm">
                                    {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                                </div>
                                <div>
                                    <p className="font-semibold text-sky-900">Upload receipt or order</p>
                                    <p className="text-sm text-sky-700">Turn purchases into usable inventory</p>
                                </div>
                            </div>
                            <p className="text-xs text-sky-700/80">Works for receipts, store screenshots, or gallery photos.</p>
                        </button>
                    </div>

                    <div className="rounded-2xl border border-gray-200 p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Upload className="w-4 h-4 text-gray-500" />
                            <p className="font-semibold text-gray-800">Type what you already have</p>
                        </div>
                        <textarea
                            value={manualInput}
                            onChange={(event) => setManualInput(event.target.value)}
                            rows={4}
                            placeholder="Examples: paneer, curd, spinach, tomatoes, roti dough"
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 outline-none resize-none"
                        />
                        <p className="text-xs text-gray-400 mt-2">Separate items with commas or new lines.</p>
                    </div>

                    {error && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Package2 className="w-4 h-4 text-gray-500" />
                                <p className="font-semibold text-gray-800">Current What I Have</p>
                            </div>
                            {existingItems.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {existingItems.map((item) => (
                                        <span
                                            key={item.id}
                                            className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1.5 text-sm font-medium"
                                        >
                                            {item.name}
                                            <button
                                                onClick={() => onRemoveItem(item.id)}
                                                className="text-emerald-700 hover:text-red-600 transition-colors"
                                                title={`Remove ${item.name}`}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">No saved inventory yet. Add a photo or type a few ingredients to start.</p>
                            )}
                        </div>

                        {mergedDraftItems.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className="w-4 h-4 text-orange-500" />
                                    <p className="font-semibold text-gray-800">Ready to add</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {mergedDraftItems.map((item) => (
                                        <span
                                            key={`${item.source}-${item.name}`}
                                            className="inline-flex items-center gap-2 rounded-full bg-orange-100 text-orange-800 px-3 py-1.5 text-sm font-medium"
                                        >
                                            {item.name}
                                            <button
                                                onClick={() => handleRemoveDraft(item.name)}
                                                className="text-orange-700 hover:text-red-600 transition-colors"
                                                title={`Remove ${item.name}`}
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                        void handleFileUpload(event.target.files?.[0], 'receipt');
                        event.target.value = '';
                    }}
                />
                <input
                    ref={captureInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => {
                        void handleFileUpload(event.target.files?.[0], 'fridge_photo');
                        event.target.value = '';
                    }}
                />

                <div className="px-6 py-4 border-t bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="text-sm text-gray-500">
                        Qook will prioritize these items in the next meal plan and avoid re-adding them to groceries.
                    </div>
                    <div className="flex items-center gap-3">
                        {onSkip && (
                            <button
                                onClick={onSkip}
                                className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Skip for now
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isAnalyzing}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors inline-flex items-center gap-2"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            {ctaLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
