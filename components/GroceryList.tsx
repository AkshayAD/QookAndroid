import React, { useState, useEffect } from 'react';
import { GroceryItem, Schedule, SavedGroceryList } from '../types';
import { CheckSquare, Share2, Calendar, Loader2, ShoppingCart, Save, Clock, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { format, addDays, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import * as supabaseService from '../services/supabaseService';

interface Props {
  items: GroceryItem[];
  onToggle: (index: number) => void;
  schedule?: Schedule;
  onGenerateFromDates?: (meals: { date: string; breakfast: string; lunch: string; dinner: string }[]) => Promise<void>;
  loading?: boolean;
  onLoadSavedList?: (items: GroceryItem[]) => void;
  userId?: string;
  currentDateRange?: string;
  onShare?: (items: GroceryItem[], dateRange: string) => void;
}

const GroceryList: React.FC<Props> = ({
  items,
  onToggle,
  schedule,
  onGenerateFromDates,
  loading,
  onLoadSavedList,
  userId = 'local',
  currentDateRange,
  onShare
}) => {
  const categories = Array.from(new Set(items.map(i => i.category)));

  // Date range selection - defaults to today + 6 days
  const today = new Date();
  const defaultStartDate = format(today, 'yyyy-MM-dd');
  const defaultEndDate = format(addDays(today, 6), 'yyyy-MM-dd');

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [showHistory, setShowHistory] = useState(false);
  const [savedLists, setSavedLists] = useState<SavedGroceryList[]>([]);
  const [saving, setSaving] = useState(false);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, [userId]);

  const loadHistory = async () => {
    const history = await supabaseService.getGroceryListHistory(userId);
    setSavedLists(history);
  };

  const handleShare = () => {
    if (onShare) {
      const range = currentDateRange || `${format(parseISO(startDate), 'MMM d')} - ${format(parseISO(endDate), 'MMM d, yyyy')}`;
      onShare(items, range);
      return;
    }
    const text = items.map(i => `${i.checked ? '[x]' : '[ ]'} ${i.item} (${i.quantity})`).join('\n');
    if (navigator.share) {
      navigator.share({
        title: 'CookCommander Grocery List',
        text: text + '\n\nPlanned via QookCommander - free AI meal planner',
      });
    } else {
      navigator.clipboard.writeText(text);
      alert('List copied to clipboard!');
    }
  };

  const handleSaveList = async () => {
    if (items.length === 0) {
      alert('No items to save');
      return;
    }

    setSaving(true);
    try {
      const dateRange = currentDateRange || `${format(parseISO(startDate), 'MMM d')} - ${format(parseISO(endDate), 'MMM d, yyyy')}`;
      await supabaseService.saveGroceryListToHistory(items, dateRange, userId);
      await loadHistory();
      alert('Grocery list saved!');
    } catch (error) {
      console.error('Failed to save list:', error);
      alert('Failed to save list');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadList = (list: SavedGroceryList) => {
    if (onLoadSavedList) {
      onLoadSavedList(list.items);
    }
    setShowHistory(false);
  };

  const handleDeleteList = async (listId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this saved list?')) return;

    await supabaseService.deleteGroceryList(listId, userId);
    await loadHistory();
  };

  const handleGenerateFromDates = () => {
    if (!onGenerateFromDates || !schedule) return;

    const start = parseISO(startDate);
    const end = parseISO(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      alert('Please select valid dates');
      return;
    }

    if (start > end) {
      alert('Start date must be before end date');
      return;
    }

    // Collect meals for the date range
    const meals: { date: string; breakfast: string; lunch: string; dinner: string }[] = [];
    let current = start;
    while (current <= end) {
      const dateKey = format(current, 'yyyy-MM-dd');
      const dayPlan = schedule[dateKey];
      meals.push({
        date: dateKey,
        breakfast: dayPlan?.breakfast || '',
        lunch: dayPlan?.lunch || '',
        dinner: dayPlan?.dinner || ''
      });
      current = addDays(current, 1);
    }

    // Check if there are any meals in this range
    const hasMeals = meals.some(d => d.breakfast || d.lunch || d.dinner);
    if (!hasMeals) {
      alert('No meals scheduled for this date range. Please add meals to the calendar first.');
      return;
    }

    onGenerateFromDates(meals);
  };

  // Quick presets for date selection
  const setThisWeek = () => {
    setStartDate(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    setEndDate(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  };

  const setNextWeek = () => {
    const nextWeekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), 7);
    setStartDate(format(nextWeekStart, 'yyyy-MM-dd'));
    setEndDate(format(addDays(nextWeekStart, 6), 'yyyy-MM-dd'));
  };

  const setNext7Days = () => {
    setStartDate(format(today, 'yyyy-MM-dd'));
    setEndDate(format(addDays(today, 6), 'yyyy-MM-dd'));
  };

  return (
    <div className="space-y-4">
      {/* Date Range Selector */}
      {onGenerateFromDates && schedule && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-600" />
            Generate Grocery List from Schedule
          </h3>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-gray-500 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <button
              onClick={handleGenerateFromDates}
              disabled={loading}
              data-tour="generate-grocery-button"
              className="w-full sm:w-auto px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-sm min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4" />
                  Generate List
                </>
              )}
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={setThisWeek}
              className="px-3 py-2 text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors min-h-[36px]"
            >
              This Week
            </button>
            <button
              onClick={setNextWeek}
              className="px-3 py-2 text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors min-h-[36px]"
            >
              Next Week
            </button>
            <button
              onClick={setNext7Days}
              className="px-3 py-2 text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors min-h-[36px]"
            >
              Next 7 Days
            </button>
          </div>
        </div>
      )}

      {/* Saved Lists History */}
      {savedLists.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span className="font-medium text-gray-700">Saved Lists</span>
              <span className="text-xs text-gray-400">({savedLists.length})</span>
            </div>
            {showHistory ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showHistory && (
            <div className="border-t border-gray-100 max-h-[200px] overflow-y-auto">
              {savedLists.map(list => (
                <div
                  key={list.id}
                  onClick={() => handleLoadList(list)}
                  className="p-3 border-b border-gray-50 hover:bg-indigo-50 cursor-pointer flex items-center justify-between group transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm text-gray-800">{list.dateRange}</p>
                    <p className="text-xs text-gray-500">{list.items.length} items • {format(new Date(list.createdAt), 'MMM d, h:mm a')}</p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteList(list.id, e)}
                    className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grocery List */}
      {items.length === 0 ? (
        <div className="text-center p-8 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium">No grocery list generated yet.</p>
          <p className="text-sm mt-1">
            {onGenerateFromDates
              ? "Select a date range above and click 'Generate List'"
              : "Create a meal plan first."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-4 bg-orange-50 border-b border-orange-100">
            <div className="flex justify-between items-center mb-3 sm:mb-0">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-orange-600" /> Grocery List
                <span className="text-sm font-normal text-gray-500">({items.length} items)</span>
              </h2>
              {/* Desktop buttons */}
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={handleSaveList}
                  disabled={saving}
                  className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                  title="Save to History"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                </button>
                <button onClick={handleShare} className="p-2 text-orange-600 hover:text-orange-700 hover:bg-orange-100 rounded-lg transition-colors" title="Share List">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            {/* Mobile prominent buttons */}
            <div className="flex gap-2 sm:hidden">
              <button
                onClick={handleSaveList}
                disabled={saving}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
              <button
                onClick={handleShare}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share List
              </button>
            </div>
          </div>

          <div className="p-4 space-y-6 max-h-[600px] overflow-y-auto">
            {categories.map(category => (
              <div key={category}>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{category}</h3>
                <ul className="space-y-2">
                  {items.map((item, idx) => {
                    if (item.category !== category) return null;
                    return (
                      <li key={idx} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer" onClick={() => onToggle(idx)}>
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${item.checked ? 'bg-orange-500 border-orange-500' : 'border-gray-300'}`}>
                          {item.checked && <span className="text-white text-xs">✓</span>}
                        </div>
                        <div className={item.checked ? 'opacity-50 line-through' : ''}>
                          <span className="font-medium text-gray-800">{item.item}</span>
                          <span className="text-gray-500 text-sm ml-2">- {item.quantity}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroceryList;