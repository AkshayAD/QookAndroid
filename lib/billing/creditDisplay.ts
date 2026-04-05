import { UserCredits } from '../../types/subscription';

export function isDisplayingFamilyCredits(
    credits: UserCredits | null,
    isFamilyModeActive: boolean
): boolean {
    return credits?.family_mode ?? isFamilyModeActive;
}

export function getCreditDisplayValue(
    credits: UserCredits | null,
    loading: boolean
): string {
    if (credits) {
        return String(credits.total_credits);
    }

    return loading ? '...' : '--';
}
