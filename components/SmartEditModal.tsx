import React, { useEffect, useMemo, useState } from 'react';
import { DayPlan, UserPreferences } from '../types';
import { X, Sparkles, Send, Check, Camera, Image, Loader2, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNative } from '../utils/platform';
import { getApiBaseUrl } from '../utils/platform';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  dayPlan: DayPlan;
  preferences: UserPreferences;
  enabledMealTypes?: Array<'breakfast' | 'lunch' | 'dinner'>;
  onConfirm: (updates: Record<string, string>) => void;
  onClose: () => void;
  onAnalyze: (mealTypes: string[], instruction: string) => Promise<{ options: Record<string, string[]> }>;
}

const SmartEditModal: React.FC<Props> = ({ dayPlan, onConfirm, onClose, onAnalyze, enabledMealTypes = ['breakfast', 'lunch', 'dinner'] }) => {
  const availableMealTypes = useMemo(
    () => (enabledMealTypes.length > 0 ? enabledMealTypes : ['breakfast', 'lunch', 'dinner'])
      .map((type) => `${type.charAt(0).toUpperCase()}${type.slice(1)}`),
    [enabledMealTypes]
  );
  const [selectedTypes, setSelectedTypes] = useState<string[]>(() => [availableMealTypes[0] || 'Lunch']);
  const [instruction, setInstruction] = useState('');
  const [generatedOptions, setGeneratedOptions] = useState<Record<string, string[]> | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  
  // Image capture state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [extractedIngredients, setExtractedIngredients] = useState<string[]>([]);
  const [extractingIngredients, setExtractingIngredients] = useState(false);
  
  const { user } = useAuth();

  useEffect(() => {
    setSelectedTypes((previous) => {
      const filtered = previous.filter((type) => availableMealTypes.includes(type));
      return filtered.length > 0 ? filtered : [availableMealTypes[0] || 'Lunch'];
    });
  }, [availableMealTypes]);

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
    setGeneratedOptions(null);
    setSelectedOptions({});
  };

  // Capture photo from camera or gallery
  const capturePhoto = async (source: CameraSource) => {
    try {
      const photo = await CapCamera.getPhoto({
        quality: 80,
        resultType: CameraResultType.Base64,
        source: source,
        allowEditing: false,
      });
      
      if (photo.base64String) {
        setCapturedImage(photo.base64String);
        await extractIngredients(photo.base64String, photo.format || 'jpeg');
      }
    } catch (e: any) {
      // User cancelled or error
      console.log('Photo capture cancelled or failed:', e);
    }
  };

  // Extract ingredients from image using grocery-vision API
  const extractIngredients = async (imageData: string, format: string) => {
    setExtractingIngredients(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/grocery-vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || 'anonymous',
          imageData: imageData,
          imageType: `image/${format}`,
        }),
      });
      
      const result = await response.json();
      if (result.success && result.groceries) {
        const ingredients = result.groceries.map((g: any) => g.item);
        setExtractedIngredients(ingredients);
        
        // Auto-populate instruction if empty
        if (!instruction.trim() && ingredients.length > 0) {
          setInstruction(`Make meals using these ingredients from my fridge/pantry`);
        }
      }
    } catch (e) {
      console.error('Failed to extract ingredients:', e);
    } finally {
      setExtractingIngredients(false);
    }
  };

  // Clear captured image
  const clearImage = () => {
    setCapturedImage(null);
    setExtractedIngredients([]);
  };

  const handleAnalyze = async () => {
    if (selectedTypes.length === 0) return;
    if (!instruction.trim() && extractedIngredients.length === 0) return;
    
    setLoading(true);
    setGeneratedOptions(null);
    setSelectedOptions({});
    
    try {
      // Add extracted ingredients to the instruction
      let enhancedInstruction = instruction.trim();
      if (extractedIngredients.length > 0) {
        enhancedInstruction = `${instruction}\n\nIMPORTANT: Use these available ingredients from my pantry/fridge: ${extractedIngredients.join(', ')}. Prioritize using what I have available.`;
      }
      
      const result = await onAnalyze(selectedTypes, enhancedInstruction);
      const options = (result as any).options || result;
      setGeneratedOptions(options);
      
      const defaults: Record<string, number> = {};
      Object.keys(options).forEach(key => {
        defaults[key] = 0;
      });
      setSelectedOptions(defaults);
    } catch (e) {
      console.error(e);
      alert('Failed to generate options. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (mealType: string, index: number) => {
    setSelectedOptions(prev => ({ ...prev, [mealType]: index }));
  };

  const handleAccept = () => {
    if (generatedOptions) {
      const updates: Record<string, string> = {};
      Object.entries(generatedOptions).forEach(([mealType, options]) => {
        const selectedIndex = selectedOptions[mealType] ?? 0;
        updates[mealType] = options[selectedIndex];
      });
      onConfirm(updates);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <h2 className="text-xl font-bold">Smart Edit: {dayPlan.day}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* Meal Selector Pills */}
          <div className="mb-6">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">Select Meals to Edit</label>
            <div className="flex gap-2">
              {availableMealTypes.map((type) => {
                const isSelected = selectedTypes.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`flex-1 py-2 px-3 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 ${isSelected
                      ? 'bg-indigo-600 text-white shadow-md transform scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Meal Display (Only selected) */}
          <div className="mb-6 space-y-2">
            {selectedTypes.map(type => (
              <div key={type} className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex justify-between items-center">
                <div>
                  <span className="text-xs font-semibold text-gray-400 uppercase block">{type}</span>
                  <span className="text-gray-800 text-sm font-medium">{String(dayPlan[type.toLowerCase() as keyof typeof dayPlan] || '')}</span>
                </div>
              </div>
            ))}
            {selectedTypes.length === 0 && <p className="text-sm text-gray-400 italic">Select a meal type above to start.</p>}
          </div>

          {/* Photo Capture Section */}
          <div className="mb-6">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">
              📷 Add Photo (Optional)
            </label>
            
            {!capturedImage ? (
              <div className="flex gap-2">
                <button
                  onClick={() => capturePhoto(CameraSource.Camera)}
                  className="flex-1 flex items-center justify-center gap-2 p-3 bg-emerald-50 border-2 border-emerald-200 rounded-xl text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-sm font-medium">Camera</span>
                </button>
                <button
                  onClick={() => capturePhoto(CameraSource.Photos)}
                  className="flex-1 flex items-center justify-center gap-2 p-3 bg-blue-50 border-2 border-blue-200 rounded-xl text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <Image className="w-5 h-5" />
                  <span className="text-sm font-medium">Gallery</span>
                </button>
              </div>
            ) : (
              <div className="relative">
                <img 
                  src={`data:image/jpeg;base64,${capturedImage}`} 
                  alt="Captured" 
                  className="w-full h-32 object-cover rounded-xl"
                />
                <button
                  onClick={clearImage}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                
                {/* Extracted Ingredients Display */}
                {extractingIngredients && (
                  <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                    <div className="flex items-center gap-2 text-white">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Extracting ingredients...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Show extracted ingredients */}
            {extractedIngredients.length > 0 && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-xs font-bold text-emerald-700 block mb-2">
                  ✅ Found {extractedIngredients.length} ingredients:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {extractedIngredients.slice(0, 10).map((item, i) => (
                    <span key={i} className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full">
                      {item}
                    </span>
                  ))}
                  {extractedIngredients.length > 10 && (
                    <span className="text-xs text-emerald-600">+{extractedIngredients.length - 10} more</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Chat Interface */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
              Instructions for AI
            </label>
            <div className="relative">
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={extractedIngredients.length > 0 
                  ? `Tell AI what to make with your ingredients, e.g., "Make a quick lunch"`
                  : `e.g., "Make it vegan", "Too heavy, change to soup", "No rice today"`}
                className="w-full p-4 pr-12 bg-white border-2 border-indigo-100 rounded-xl focus:border-indigo-500 focus:ring-0 outline-none resize-none text-gray-700 placeholder-gray-400"
                rows={3}
              />
              <button
                onClick={handleAnalyze}
                disabled={loading || selectedTypes.length === 0 || (!instruction.trim() && extractedIngredients.length === 0)}
                className="absolute bottom-3 right-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* AI Response Area - 3 Options per Meal */}
          {generatedOptions && (
            <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-indigo-600 uppercase flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Choose Your Meal Options
                </span>
              </div>

              {Object.entries(generatedOptions).map(([mealType, options]) => (
                <div key={mealType} className="space-y-2">
                  <span className="text-xs font-bold text-gray-500 uppercase block">{mealType}</span>
                  <div className="space-y-2">
                    {options.map((option, index) => {
                      const isSelected = selectedOptions[mealType] === index;
                      return (
                        <button
                          key={index}
                          onClick={() => handleSelectOption(mealType, index)}
                          className={`w-full text-left p-3 rounded-xl border-2 transition-all ${isSelected
                            ? 'border-indigo-500 bg-indigo-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
                            }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                              }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div className="flex-1">
                              <span className="text-xs font-medium text-gray-400 mb-1 block">Option {index + 1}</span>
                              <div className="markdown-body text-gray-800 text-sm font-medium">
                                <ReactMarkdown>{String(option)}</ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button
                onClick={handleAccept}
                className="w-full mt-4 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Apply Selected Options
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartEditModal;
