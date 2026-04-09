import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import PlannerDateStrip from './PlannerDateStrip';

function StripHarness() {
    const [selectedDate, setSelectedDate] = useState(new Date(2026, 3, 5));
    const [rangeStartDate, setRangeStartDate] = useState(new Date(2026, 3, 5));

    const handleDateSelect = (date: Date) => {
        setSelectedDate(date);
        setRangeStartDate(date);
    };

    return (
        <PlannerDateStrip
            selectedDate={selectedDate}
            rangeStartDate={rangeStartDate}
            onDateSelect={handleDateSelect}
            schedule={{
                '2026-04-05': { day: '2026-04-05', breakfast: 'Poha', lunch: '', dinner: '' },
                '2026-04-10': { day: '2026-04-10', breakfast: '', lunch: 'Rajma', dinner: '' },
            }}
        />
    );
}

describe('PlannerDateStrip', () => {
    it('requests a new 7-day planner range starting from the clicked date', async () => {
        const user = userEvent.setup();
        render(<StripHarness />);

        const startDayButton = screen.getByText('5').closest('button');
        const clickedDayButton = screen.getByText('10').closest('button');

        expect(startDayButton).not.toBeNull();
        expect(clickedDayButton).not.toBeNull();
        expect(startDayButton?.className).toContain('bg-orange-500');

        await user.click(clickedDayButton!);

        expect(clickedDayButton?.className).toContain('bg-orange-500');
        expect(startDayButton?.className).not.toContain('bg-orange-500');
        expect(startDayButton?.className).not.toContain('bg-orange-100');
    });
});
