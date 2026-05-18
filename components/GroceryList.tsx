import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Check, CheckSquare, ChevronDown, ChevronUp, Clock, Home, Loader2, Plus, Save, Share2, ShoppingCart, Trash2 } from 'lucide-react';
import { addDays, endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
import type { GroceryItem, SavedGroceryList, Schedule } from '../types';
import * as supabaseService from '../services/supabaseService';
import { formatCompactDateRange, normalizeCompactDateRangeLabel } from '../lib/dateRange';

interface Props {
  items: GroceryItem[];
  onToggle: (index: number) => void;
  onDeleteItem?: (index: number) => void;
  onAddItem?: (item: { item: string; quantity: string; category: string }) => void;
  onRememberItem?: (index: number, target: 'inventory' | 'staple') => Promise<void> | void;
  schedule?: Schedule;
  onGenerateFromDates?: (meals: { date: string; breakfast: string; lunch: string; dinner: string }[]) => Promise<void>;
  loading?: boolean;
  onLoadSavedList?: (items: GroceryItem[], dateRange?: string) => void;
  userId?: string;
  currentDateRange?: string;
  onShare?: (items: GroceryItem[], dateRange: string) => void;
}

const GroceryList: React.FC<Props> = ({
  items,
  onToggle,
  onDeleteItem,
  onAddItem,
  onRememberItem,
  schedule,
  onGenerateFromDates,
  loading,
  onLoadSavedList,
  userId = 'local',
  currentDateRange,
  onShare,
}) => {
  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category || 'Other'))),
    [items]
  );

  const today = new Date();
  const defaultStartDate = format(today, 'yyyy-MM-dd');
  const defaultEndDate = format(addDays(today, 6), 'yyyy-MM-dd');

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [showHistory, setShowHistory] = useState(false);
  const [savedLists, setSavedLists] = useState<SavedGroceryList[]>([]);
  const [saving, setSaving] = useState(false);
  const [rememberMenuIndex, setRememberMenuIndex] = useState<number | null>(null);
  const [draftItem, setDraftItem] = useState({ item: '', quantity: '', category: 'Produce' });

  const resolvedDateRange = currentDateRange || formatCompactDateRange(startDate, endDate);
  const visibleDateRange = normalizeCompactDateRangeLabel(resolvedDateRange);

  useEffect(() => {
    void loadHistory();
  }, [userId]);

  const loadHistory = async () => {
    const history = await supabaseService.getGroceryListHistory(userId);
    setSavedLists(history);
  };

  const handleShare = () => {
    if (onShare) {
      onShare(items, visibleDateRange);
      return;
    }

    const text = items.map((item) => `${item.checked ? '[x]' : '[ ]'} ${item.item} (${item.quantity})`).join('\n');
    if (navigator.share) {
      void navigator.share({
        title: 'CookCommander Grocery List',
        text: `${text}\n\nPlanned via QookCommander - free AI meal planner`,
      });
      return;
    }

    void navigator.clipboard.writeText(text);
    alert('List copied to clipboard!');
  };

  const handleSaveList = async () => {
    if (items.length === 0) {
      alert('No items to save');
      return;
    }

    setSaving(true);
    try {
      await supabaseService.saveGroceryListToHistory(items, visibleDateRange, userId);
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
    onLoadSavedList?.(list.items, normalizeCompactDateRangeLabel(list.dateRange));
    setShowHistory(false);
  };

  const handleDeleteList = async (listId: string, event: React.MouseEvent) => {
    event.stopPropagation();
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

    const meals: { date: string; breakfast: string; lunch: string; dinner: string }[] = [];
    let current = start;
    while (current <= end) {
      const dateKey = format(current, 'yyyy-MM-dd');
      const dayPlan = schedule[dateKey];
      meals.push({
        date: dateKey,
        breakfast: dayPlan?.breakfast || '',
        lunch: dayPlan?.lunch || '',
        dinner: dayPlan?.dinner || '',
      });
      current = addDays(current, 1);
    }

    const hasMeals = meals.some((day) => day.breakfast || day.lunch || day.dinner);
    if (!hasMeals) {
      alert('No meals scheduled for this date range. Please add meals in the grocery calendar tab first.');
      return;
    }

    void onGenerateFromDates(meals);
  };

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

  const handleAddDraftItem = () => {
    const nextItem = draftItem.item.trim();
    if (!nextItem) {
      return;
    }

    onAddItem?.({
      item: nextItem,
      quantity: draftItem.quantity.trim() || 'As needed',
      category: draftItem.category.trim() || 'Other',
    });

    setDraftItem({ item: '', quantity: '', category: draftItem.category || 'Produce' });
  };

  const statusLabel = (item: GroceryItem) => {
    if (item.homeStatus === 'inventory') {
      return 'At home now';
    }
    if (item.homeStatus === 'staple') {
      return 'Saved as staple';
    }
    return null;
  };

  return (
    <div className="space-y-4">
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
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
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
              {savedLists.map((list) => (
                <div
                  key={list.id}
                  className="p-3 border-b border-gray-50 hover:bg-indigo-50 flex items-center justify-between gap-2 group transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => handleLoadList(list)}
                    className="flex-1 text-left rounded-lg px-1 py-0.5"
                  >
                    <p className="font-medium text-sm text-gray-800">{normalizeCompactDateRangeLabel(list.dateRange)}</p>
                    <p className="text-xs text-gray-500">{list.items.length} items | {format(new Date(list.createdAt), 'MMM d, h:mm a')}</p>
                  </button>
                  <button
                    type="button"
                    onClick={(event) => handleDeleteList(list.id, event)}
                    className="shrink-0 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <CheckSquare className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-800">How this grocery list works</p>
            <p className="text-sm text-gray-600 mt-1">
              Checkboxes mark items you bought for this trip. The home icon lets you remember an item in your kitchen, either as something you have now or as a pantry staple for future plans.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 font-medium">
            <Home className="w-3.5 h-3.5" />
            Save to home or pantry
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-gray-600 font-medium">
            <Trash2 className="w-3.5 h-3.5" />
            Remove from this list
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="font-semibold text-gray-800">Add a grocery item manually</p>
            <p className="text-sm text-gray-500">Useful when Qook missed something or you want to add household basics.</p>
          </div>
        </div>
        <div className="grid md:grid-cols-[1.6fr_1fr_1fr_auto] gap-3">
          <input
            type="text"
            value={draftItem.item}
            onChange={(event) => setDraftItem((current) => ({ ...current, item: event.target.value }))}
            placeholder="Item name"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <input
            type="text"
            value={draftItem.quantity}
            onChange={(event) => setDraftItem((current) => ({ ...current, quantity: event.target.value }))}
            placeholder="Quantity"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <input
            type="text"
            value={draftItem.category}
            onChange={(event) => setDraftItem((current) => ({ ...current, category: event.target.value }))}
            placeholder="Category"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <button
            onClick={handleAddDraftItem}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center p-8 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium">No grocery list generated yet.</p>
          <p className="text-sm mt-1">
            {onGenerateFromDates ? "Select a date range above and click 'Generate List'" : 'Create a meal plan first.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-4 bg-orange-50 border-b border-orange-100">
            <div className="flex justify-between items-start gap-3 mb-3 sm:mb-0">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-orange-600" /> Grocery List
                  <span className="text-sm font-normal text-gray-500">({items.length} items)</span>
                </h2>
                <p className="mt-1 text-sm font-semibold text-orange-700">{visibleDateRange}</p>
              </div>
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

          <div className="p-4 space-y-6">
            {categories.map((category) => (
              <div key={category}>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{category}</h3>
                <ul className="space-y-2">
                  {items.map((item, idx) => {
                    if ((item.category || 'Other') !== category) return null;

                    const status = statusLabel(item);
                    const isMenuOpen = rememberMenuIndex === idx;

                    return (
                      <li key={`${category}-${idx}`} className="rounded-xl border border-gray-100 bg-white">
                        <div className="flex items-start gap-3 p-3">
                          <button
                            onClick={() => onToggle(idx)}
                            className="mt-0.5 shrink-0"
                            title={item.checked ? 'Mark as not bought' : 'Mark as bought'}
                          >
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${item.checked ? 'bg-orange-500 border-orange-500' : 'border-gray-300 bg-white'}`}>
                              {item.checked && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </button>

                          <button
                            onClick={() => onToggle(idx)}
                            className="flex-1 text-left"
                          >
                            <div className={item.checked ? 'opacity-50 line-through' : ''}>
                              <div className="font-medium text-gray-800">{item.item}</div>
                              <div className="text-sm text-gray-500 mt-0.5">{item.quantity}</div>
                            </div>
                            {status && (
                              <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${item.homeStatus === 'staple' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                <Home className="w-3.5 h-3.5" />
                                {status}
                              </span>
                            )}
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                setRememberMenuIndex(isMenuOpen ? null : idx);
                              }}
                              className="p-2 rounded-lg text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                              title="Remember this in your kitchen"
                            >
                              <Home className="w-4 h-4" />
                            </button>
                            {onDeleteItem && (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onDeleteItem(idx);
                                  setRememberMenuIndex((current) => (current === idx ? null : current));
                                }}
                                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Delete item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {isMenuOpen && (
                          <div className="border-t border-gray-100 px-3 py-3 bg-gray-50">
                            <p className="text-xs font-medium text-gray-500 mb-2">Remember this item in your kitchen as:</p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => {
                                  void onRememberItem?.(idx, 'inventory');
                                  setRememberMenuIndex(null);
                                }}
                                className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                              >
                                At home now
                              </button>
                              <button
                                onClick={() => {
                                  void onRememberItem?.(idx, 'staple');
                                  setRememberMenuIndex(null);
                                }}
                                className="rounded-full bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
                              >
                                Pantry staple
                              </button>
                            </div>
                          </div>
                        )}
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
