import React from 'react';

interface MealListProps {
    content: string;
    className?: string;
    bulletColorClass?: string;
    textSizeClass?: string;
    showQuantities?: boolean;
}

const extractQuantity = (item: string): { name: string; quantity: string | null } => {
    const englishUnits = 'g|kg|ml|l|cups?|pieces?|tbsp|tsp|dozen|bunch|bunches|servings?|slices?|bowls?';
    const quantityMatch = item.match(new RegExp(`\\(([^)]+(?:${englishUnits})[^)]*)\\)$`, 'i'));

    if (quantityMatch) {
        return {
            name: item.replace(quantityMatch[0], '').trim(),
            quantity: quantityMatch[1].trim(),
        };
    }

    const genericMatch = item.match(/\((\d+[^)]*)\)$/);
    if (genericMatch) {
        return {
            name: item.replace(genericMatch[0], '').trim(),
            quantity: genericMatch[1].trim(),
        };
    }

    return { name: item, quantity: null };
};

const splitItems = (content: string): string[] => {
    const byLine = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => line !== '•' && line !== '*' && line !== '-')
        .map((line) => line.replace(/^[\s•*\-›]+\s*/, '').trim());

    if (byLine.length === 1 && (content.includes('•') || content.includes('*'))) {
        return content
            .split(/[•*]/)
            .map((part) => part.trim())
            .filter((part) => part.length > 0);
    }

    return byLine;
};

const MealList: React.FC<MealListProps> = ({
    content,
    className = '',
    bulletColorClass = 'text-slate-300',
    textSizeClass = 'text-sm',
    showQuantities = true,
}) => {
    if (!content) {
        return null;
    }

    const items = splitItems(content);
    if (items.length === 0) {
        return null;
    }

    return (
        <ul className={`space-y-1 ${className}`}>
            {items.map((item, index) => {
                const { name, quantity } = showQuantities ? extractQuantity(item) : { name: item, quantity: null };

                return (
                    <li key={index} className={`flex items-start gap-2 ${textSizeClass} leading-snug text-slate-700`}>
                        <span className={`mt-[1px] text-sm font-semibold leading-none select-none ${bulletColorClass}`}>
                            ›
                        </span>
                        <span className="flex min-w-0 flex-1 items-start justify-between gap-2">
                            <span className="min-w-[60%] flex-shrink break-words font-semibold text-slate-700">
                                {name}
                            </span>
                            {quantity && (
                                <span
                                    className="max-w-[40%] flex-shrink-0 rounded-full bg-slate-50 px-2 py-0.5 text-right text-[10px] font-medium text-slate-400 break-words"
                                    title={quantity}
                                >
                                    {quantity}
                                </span>
                            )}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
};

export default MealList;
