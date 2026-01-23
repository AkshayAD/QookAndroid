
import React, { useState } from 'react';
import { X, Star, Send, Loader2, MessageSquareHeart } from 'lucide-react';
import { submitFeedback } from '../services/supabaseService';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, userId }) => {
    const [rating, setRating] = useState<number>(0);
    const [whatWorks, setWhatWorks] = useState('');
    const [whatNeedsImprovement, setWhatNeedsImprovement] = useState('');
    const [suggestions, setSuggestions] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0) {
            setError('Please select a star rating');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await submitFeedback({
                rating,
                whatWorks,
                whatNeedsImprovement,
                suggestions
            }, userId);
            setSubmitted(true);
            setTimeout(() => {
                onClose();
                setSubmitted(false);
                setRating(0);
                setWhatWorks('');
                setWhatNeedsImprovement('');
                setSuggestions('');
            }, 2000);
        } catch (err) {
            console.error(err);
            setError('Failed to submit feedback. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-indigo-50">
                    <div className="flex items-center gap-2">
                        <MessageSquareHeart className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-lg font-bold text-gray-800">Help Us Improve</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {submitted ? (
                    <div className="p-12 flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                            <Send className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Thank You!</h3>
                        <p className="text-gray-600">Your feedback helps us make QookCommander better for everyone.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Rating */}
                        <div className="text-center">
                            <label className="block text-sm font-bold text-gray-700 mb-3">Rate your experience</label>
                            <div className="flex justify-center gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        className="p-1 transition-transform hover:scale-110 focus:outline-none"
                                    >
                                        <Star
                                            className={`w-8 h-8 ${rating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* What works */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">What is working well?</label>
                            <textarea
                                value={whatWorks}
                                onChange={(e) => setWhatWorks(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                                rows={2}
                                placeholder="E.g., The meal planner is very intuitive..."
                            />
                        </div>

                        {/* What needs improvement */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">What could be better?</label>
                            <textarea
                                value={whatNeedsImprovement}
                                onChange={(e) => setWhatNeedsImprovement(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                                rows={2}
                                placeholder="E.g., I wish the grocery list could..."
                            />
                        </div>

                        {/* Suggestions */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Any other suggestions?</label>
                            <textarea
                                value={suggestions}
                                onChange={(e) => setSuggestions(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                                rows={2}
                                placeholder="Any feature requests or ideas..."
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                                <span className="block w-1.5 h-1.5 bg-red-500 rounded-full" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting || rating === 0}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    Submit Feedback
                                    <Send className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default FeedbackModal;
