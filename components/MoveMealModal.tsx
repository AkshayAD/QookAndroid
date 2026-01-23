import React, { useState } from 'react';
import { MealTransfer } from '../types';
import { format, addDays } from 'date-fns';
import { ArrowRight, Copy, Move, X, Users, User } from 'lucide-react';
import { useFamily } from '../contexts/FamilyContext';

interface Props {
    transfer: MealTransfer;
    onConfirm: (targetDate: string, targetType: string, action: 'copy' | 'move', targetFamilyGroupId?: string | null) => void;
    onClose: () => void;
}

const MoveMealModal: React.FC<Props> = ({ transfer, onConfirm, onClose }) => {
    const { isInFamily, isFamilyModeActive, familyGroup } = useFamily();

    // Default to same day if moving type, or tomorrow if moving date
    const [targetDate, setTargetDate] = useState(transfer.sourceDate);
    const [targetType, setTargetType] = useState(transfer.sourceMealType);
    const [action, setAction] = useState<'copy' | 'move'>('copy');
    const [copyToOtherMode, setCopyToOtherMode] = useState(false);

    const handleSubmit = () => {
        // Determine target family group ID
        let targetFamilyGroupId: string | null | undefined;

        if (copyToOtherMode && isInFamily) {
            // If copying to other mode, flip the family group
            targetFamilyGroupId = isFamilyModeActive ? null : familyGroup?.id;
        } else {
            // Keep in same mode
            targetFamilyGroupId = isFamilyModeActive ? familyGroup?.id : null;
        }

        onConfirm(targetDate, targetType, action, targetFamilyGroupId);
        onClose();
    };

    const targetModeName = copyToOtherMode
        ? (isFamilyModeActive ? 'Personal' : 'Family')
        : (isFamilyModeActive ? 'Family' : 'Personal');

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-800">Organize Meal</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
                </div>

                <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 mb-6">
                    <span className="text-xs font-bold text-orange-400 uppercase">{transfer.sourceMealType}</span>
                    <p className="font-medium text-gray-800">{transfer.sourceMealName}</p>
                    <p className="text-xs text-gray-500 mt-1">{format(new Date(transfer.sourceDate), 'EEE, MMM d')}</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1 block">Action</label>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setAction('copy')}
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 ${action === 'copy' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
                            >
                                <Copy className="w-3 h-3" /> Copy
                            </button>
                            <button
                                onClick={() => setAction('move')}
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 ${action === 'move' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
                            >
                                <Move className="w-3 h-3" /> Move
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1 block">To Date</label>
                        <input
                            type="date"
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            className="w-full p-2 border rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1 block">To Meal Slot</label>
                        <select
                            value={targetType}
                            onChange={(e) => setTargetType(e.target.value)}
                            className="w-full p-2 border rounded-lg bg-white"
                        >
                            <option value="Breakfast">Breakfast</option>
                            <option value="Lunch">Lunch</option>
                            <option value="Dinner">Dinner</option>
                        </select>
                    </div>

                    {/* Copy to other mode option - only show if user is in a family */}
                    {isInFamily && action === 'copy' && (
                        <div className="border-t pt-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={copyToOtherMode}
                                    onChange={(e) => setCopyToOtherMode(e.target.checked)}
                                    className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                                />
                                <div className="flex items-center gap-2">
                                    {isFamilyModeActive ? (
                                        <User className="w-4 h-4 text-gray-500" />
                                    ) : (
                                        <Users className="w-4 h-4 text-orange-500" />
                                    )}
                                    <span className="text-sm font-medium text-gray-700">
                                        Copy to {isFamilyModeActive ? 'Personal' : 'Family'} Mode
                                    </span>
                                </div>
                            </label>
                            {copyToOtherMode && (
                                <p className="text-xs text-gray-500 mt-2 ml-7">
                                    This meal will be copied to your {isFamilyModeActive ? 'personal' : 'family'} schedule
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <button
                    onClick={handleSubmit}
                    className="w-full mt-6 py-2 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-800"
                >
                    {action === 'copy' ? 'Copy' : 'Move'} to {targetModeName}
                </button>
            </div>
        </div>
    );
};

export default MoveMealModal;
