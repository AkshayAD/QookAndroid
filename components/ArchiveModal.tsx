import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Save, AlertTriangle, RotateCcw } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { Schedule, DayPlan } from '../types';

interface Props {
  onConfirm: (startDate: string, overwrite: boolean) => void;
  onClose: () => void;
  schedule?: Schedule;
  daysCount?: number;
  startDateOverride?: string; // If provided, use this date instead of showing date picker
}

const ArchiveModal: React.FC<Props> = ({ onConfirm, onClose, schedule = {}, daysCount = 7, startDateOverride }) => {
  const [date, setDate] = useState(startDateOverride || format(new Date(), 'yyyy-MM-dd'));
  const [overwrite, setOverwrite] = useState(true);
  const [existingDates, setExistingDates] = useState<string[]>([]);

  // Check for existing meals when date changes
  useEffect(() => {
    const startDate = parseISO(date);
    if (isNaN(startDate.getTime())) return;

    const datesWithMeals: string[] = [];
    for (let i = 0; i < daysCount; i++) {
      const currentDate = addDays(startDate, i);
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      const existing = schedule[dateKey];
      if (existing && (existing.breakfast || existing.lunch || existing.dinner)) {
        datesWithMeals.push(format(currentDate, 'MMM d'));
      }
    }
    setExistingDates(datesWithMeals);
  }, [date, schedule, daysCount]);

  const handleConfirm = () => {
    onConfirm(date, overwrite);
    onClose();
  };

  const hasConflicts = existingDates.length > 0;

  return (
    <div className="app-modal-frame bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="app-modal-surface bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-green-100 p-1.5 rounded-lg text-green-700">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-800">Save to Calendar</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {startDateOverride ? (
            <p className="text-sm text-gray-600">
              The meal plan will be saved to your schedule starting from <strong>{format(parseISO(date), 'MMM d, yyyy')}</strong>.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Select the start date for this week's meal plan. The meals will be saved to your schedule starting from this date.
              </p>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-medium text-gray-800"
                />
              </div>
            </>
          )}

          {/* Conflict Warning */}
          {hasConflicts && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Existing meals found
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    {existingDates.length} day(s) already have scheduled meals: {existingDates.slice(0, 4).join(', ')}{existingDates.length > 4 ? '...' : ''}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="overwriteOption"
                    checked={overwrite}
                    onChange={() => setOverwrite(true)}
                    className="w-4 h-4 text-green-600"
                  />
                  <span className="text-sm text-gray-700">
                    <strong>Overwrite</strong> - Replace existing meals with new plan
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="overwriteOption"
                    checked={!overwrite}
                    onChange={() => setOverwrite(false)}
                    className="w-4 h-4 text-green-600"
                  />
                  <span className="text-sm text-gray-700">
                    <strong>Keep existing</strong> - Only fill empty days
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Info about revert */}
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            <RotateCcw className="w-3 h-3" />
            <span>You can undo this action using the Revert button in Schedule</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-gray-600 font-semibold hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-md hover:shadow-lg transition-all flex justify-center items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {hasConflicts && overwrite ? 'Overwrite & Save' : 'Save'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ArchiveModal;
