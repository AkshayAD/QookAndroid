import React from 'react';

interface MealListProps {
    content: string;
    className?: string; // For container styling
    bulletColorClass?: string; // To customize bullet color based on context (white for dark backgrounds etc)
    textSizeClass?: string; // To adjust font size contextually
    showQuantities?: boolean; // Toggle quantity display
}

/**
 * Extract quantity from a meal item string.
 * Quantities are usually in parentheses like "(2 cups)" or "(250g)" or "(4 टुकड़े)"
 * Supports both English and Hindi units.
 */
const extractQuantity = (item: string): { name: string; quantity: string | null } => {
    // English units
    const englishUnits = 'g|kg|ml|l|cups?|pieces?|tbsp|tsp|dozen|bunch|bunches|servings?|slices?|bowls?';
    // Hindi units: ग्राम (gram), कप (cup), टुकड़े (pieces), लीटर (liter), चम्मच (spoon), कटोरी (bowl), प्लेट (plate)
    const hindiUnits = 'ग्राम|कप|टुकड़े|टुकड़ा|लीटर|चम्मच|कटोरी|प्लेट|रोटी|पराठे?|चपाती|सर्विंग';
    const allUnits = `${englishUnits}|${hindiUnits}`;

    // Look for quantity patterns in parentheses at the end
    // Examples: "Paneer Butter Masala (250g paneer)", "जीरा चावल (2 कप)", "नान (4 टुकड़े)"
    const quantityMatch = item.match(new RegExp(`\\(([^)]+(?:${allUnits})[^)]*)\\)$`, 'i'));

    if (quantityMatch) {
        const quantity = quantityMatch[1].trim();
        const name = item.replace(quantityMatch[0], '').trim();
        return { name, quantity };
    }

    // Also check for quantities in the middle of the string
    const midQuantityMatch = item.match(new RegExp(`\\((\\d+[^)]*(?:${allUnits})[^)]*)\\)`, 'i'));
    if (midQuantityMatch) {
        const quantity = midQuantityMatch[1].trim();
        const name = item.replace(midQuantityMatch[0], '').trim();
        return { name, quantity };
    }

    // Fallback: Any content in parentheses at the end that looks like a quantity (has a number)
    const genericMatch = item.match(/\((\d+[^)]*)\)$/);
    if (genericMatch) {
        const quantity = genericMatch[1].trim();
        const name = item.replace(genericMatch[0], '').trim();
        return { name, quantity };
    }

    return { name: item, quantity: null };
};

/**
 * Parses a raw meal string (often containing • or * bullets) and renders it
 * as an elegant HTML list with custom chevron bullets (›).
 * Optionally displays quantities on the right side like grocery lists.
 */
const MealList: React.FC<MealListProps> = ({
    content,
    className = '',
    bulletColorClass = 'text-gray-400',
    textSizeClass = 'text-sm',
    showQuantities = true
}) => {
    if (!content) return null;

    // Split by newlines first
    // Then clean up by removing existing bullets (*, •, -) from the start of lines
    const items = content
        .split(/\r?\n/)
        .map(line => line.trim())
        // Filter out completely empty lines
        .filter(line => line.length > 0)
        // If a line is just a bullet, ignore it (rare edge case)
        .filter(line => line !== '•' && line !== '*' && line !== '-')
        // Clean up the text
        .map(line => line.replace(/^[\s•*\-]+\s*/, '').trim());

    // If after splitting we only have 1 item, and the original text had bullets in the middle
    // (e.g. "Item 1 • Item 2 • Item 3" all on one line), we should try splitting by bullet
    let finalItems = items;
    if (items.length === 1 && (content.includes('•') || content.includes('*'))) {
        finalItems = content
            .split(/[•*]/)
            .map(part => part.trim())
            .filter(part => part.length > 0);
    }

    if (finalItems.length === 0) return null;

    return (
        <ul className={`space-y-1 ${className}`}>
            {finalItems.map((item, index) => {
                const { name, quantity } = showQuantities ? extractQuantity(item) : { name: item, quantity: null };

                return (
                    <li key={index} className={`flex items-start gap-2 ${textSizeClass} text-gray-700 leading-snug`}>
                        <span className={`font-serif text-lg leading-none select-none mt-[-2px] ${bulletColorClass}`}>
                            ›
                        </span>
                        <span className="flex-1 flex justify-between items-start gap-2 min-w-0">
                            <span className="break-words flex-shrink min-w-[60%]">
                                {name}
                            </span>
                            {quantity && (
                                <span className="text-gray-500 text-xs font-medium bg-gray-100 px-1.5 py-0.5 rounded text-right break-words max-w-[40%] flex-shrink-0" title={quantity}>
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
