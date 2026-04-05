export function formatWeeklyBonusTime(value: string | null): string {
    if (!value) {
        return 'soon';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'soon';
    }

    return new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
    }).format(date);
}

export function getWeeklyBonusLabel(amount: number, isFreePlan: boolean): string {
    if (isFreePlan) {
        return `${amount} free credit${amount === 1 ? '' : 's'}`;
    }

    return `${amount} weekly bonus credit${amount === 1 ? '' : 's'}`;
}
