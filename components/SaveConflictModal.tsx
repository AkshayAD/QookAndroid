import React from 'react';
import { X, AlertTriangle, Replace, Layers } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface SaveConflictModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOverwriteAll: () => void;
    onFillEmpty: () => void;
    startDate: Date;
    existingMealCount: number;
}

const SaveConflictModal: React.FC<SaveConflictModalProps> = ({
    isOpen,
    onClose,
    onOverwriteAll,
    onFillEmpty,
    startDate,
    existingMealCount
}) => {
    if (!isOpen) return null;

    const dateRange = `${format(startDate, 'MMM d')} - ${format(addDays(startDate, 6), 'MMM d, yyyy')}`;

    return (
        <div className="app-modal-frame bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="app-modal-surface bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="bg-amber-50 px-6 py-4 flex items-center justify-between border-b border-amber-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-full">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">Week Already Has Meals</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-amber-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <p className="text-gray-600">
                        The week of <span className="font-semibold text-gray-800">{dateRange}</span> already has{' '}
                        <span className="font-semibold text-gray-800">{existingMealCount} meals</span> saved.
                    </p>
                    <p className="text-gray-600 text-sm">
                        How would you like to save the new meal plan?
                    </p>

                    {/* Options */}
                    <div className="space-y-3 pt-2">
                        <button
                            onClick={onOverwriteAll}
                            className="w-full flex items-center gap-3 p-4 bg-orange-50 hover:bg-orange-100 border-2 border-orange-200 rounded-xl transition-colors text-left"
                        >
                            <Replace className="w-5 h-5 text-orange-600 shrink-0" />
                            <div>
                                <div className="font-semibold text-gray-900">Overwrite All Meals</div>
                                <div className="text-sm text-gray-500">Replace all existing meals with the new plan</div>
                            </div>
                        </button>

                        <button
                            onClick={onFillEmpty}
                            disabled={existingMealCount >= 21}
                            className={`w-full flex items-center gap-3 p-4 border-2 rounded-xl text-left transition-colors ${existingMealCount >= 21
                                    ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                                    : 'bg-green-50 hover:bg-green-100 border-green-200 cursor-pointer'
                                }`}
                        >
                            <Layers className={`w-5 h-5 shrink-0 ${existingMealCount >= 21 ? 'text-gray-400' : 'text-green-600'}`} />
                            <div>
                                <div className={`font-semibold ${existingMealCount >= 21 ? 'text-gray-500' : 'text-gray-900'}`}>
                                    {existingMealCount >= 21 ? 'Week is Full' : 'Fill Empty Slots Only'}
                                </div>
                                <div className="text-sm text-gray-500">
                                    {existingMealCount >= 21
                                        ? 'No empty slots available to fill'
                                        : 'Keep existing meals, only add where blank'}
                                </div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t">
                    <p className="text-xs text-gray-500 text-center">
                        Close this popup to change the date and try again
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SaveConflictModal;
