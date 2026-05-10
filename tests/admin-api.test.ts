import { describe, expect, it, vi } from 'vitest';
import { getFeatureMatrix, updateFeatureAccess } from '../api/admin-api';

function createSupabaseMock(options: {
    updatedRows?: any[];
    updateError?: Error | null;
    insertedRow?: any;
    insertError?: Error | null;
}) {
    const featureUpdates: any[] = [];
    const featureInserts: any[] = [];
    const auditInserts: any[] = [];

    const updateBuilder: any = {
        eq: vi.fn(() => updateBuilder),
        select: vi.fn(async () => ({
            data: options.updatedRows ?? [],
            error: options.updateError ?? null,
        })),
    };

    const insertBuilder: any = {
        select: vi.fn(() => ({
            single: vi.fn(async () => ({
                data: options.insertedRow ?? null,
                error: options.insertError ?? null,
            })),
        })),
    };

    const featureTable = {
        update: vi.fn((patch) => {
            featureUpdates.push(patch);
            return updateBuilder;
        }),
        insert: vi.fn((row) => {
            featureInserts.push(row);
            return insertBuilder;
        }),
    };

    const auditTable = {
        insert: vi.fn(async (row) => {
            auditInserts.push(row);
            return { error: null };
        }),
    };

    const supabase = {
        from: vi.fn((table: string) => {
            if (table === 'feature_tier_access') return featureTable;
            if (table === 'admin_audit_log') return auditTable;
            throw new Error(`Unexpected table ${table}`);
        }),
    };

    return { supabase, featureTable, featureUpdates, featureInserts, auditInserts };
}

describe('updateFeatureAccess', () => {
    it('updates an existing feature tier row and returns the persisted state', async () => {
        const persistedRow = {
            feature_id: 'prep_ahead',
            tier_id: 'basic',
            enabled: true,
            updated_at: '2026-05-10T00:00:00.000Z',
        };
        const { supabase, featureTable, featureUpdates, featureInserts, auditInserts } = createSupabaseMock({
            updatedRows: [persistedRow],
        });

        const result = await updateFeatureAccess(supabase, 'admin-1', 'prep_ahead', 'basic', true);

        expect(featureTable.update).toHaveBeenCalledTimes(1);
        expect(featureUpdates[0]).toMatchObject({ enabled: true });
        expect(featureInserts).toHaveLength(0);
        expect(result.featureAccess).toEqual(persistedRow);
        expect(result.message).toBe('Feature prep_ahead enabled for basic');
        expect(auditInserts).toHaveLength(1);
    });

    it('inserts a missing feature tier row when update affects zero rows', async () => {
        const insertedRow = {
            feature_id: 'show_quantity',
            tier_id: 'free',
            enabled: true,
            updated_at: '2026-05-10T00:00:00.000Z',
        };
        const { supabase, featureInserts, auditInserts } = createSupabaseMock({
            updatedRows: [],
            insertedRow,
        });

        const result = await updateFeatureAccess(supabase, 'admin-1', 'show_quantity', 'free', true);

        expect(featureInserts).toHaveLength(1);
        expect(featureInserts[0]).toMatchObject({
            feature_id: 'show_quantity',
            tier_id: 'free',
            enabled: true,
        });
        expect(result.featureAccess).toEqual(insertedRow);
        expect(result.message).toBe('Feature show_quantity enabled for free');
        expect(auditInserts).toHaveLength(1);
    });

    it('throws and skips audit logging when inserting a missing row fails', async () => {
        const insertError = new Error('insert failed');
        const { supabase, auditInserts } = createSupabaseMock({
            updatedRows: [],
            insertError,
        });

        await expect(updateFeatureAccess(supabase, 'admin-1', 'nutrition_info', 'free', true))
            .rejects.toThrow('insert failed');
        expect(auditInserts).toHaveLength(0);
    });
});

describe('getFeatureMatrix', () => {
    it('merges persisted rows with default feature tiers for display', async () => {
        const featureOrderBuilder: any = {
            order: vi.fn(async () => ({
                data: [
                    { feature_id: 'meal_generation', tier_id: 'free', enabled: false },
                    { feature_id: 'custom_feature', tier_id: 'free', enabled: true },
                ],
                error: null,
            })),
        };
        const featureTable = {
            select: vi.fn(() => ({
                order: vi.fn(() => featureOrderBuilder),
            })),
        };
        const planTable = {
            select: vi.fn(() => ({
                order: vi.fn(async () => ({
                    data: [
                        { id: 'free', name: 'Free' },
                        { id: 'basic', name: 'Basic' },
                    ],
                    error: null,
                })),
            })),
        };
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'feature_tier_access') return featureTable;
                if (table === 'subscription_plans') return planTable;
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        const result = await getFeatureMatrix(supabase);

        expect(result.features).toContain('meal_generation');
        expect(result.features).toContain('show_quantity');
        expect(result.features).toContain('prep_ahead');
        expect(result.features).toContain('custom_feature');
        expect(result.featureMap.meal_generation.free).toBe(false);
        expect(result.featureMap.meal_generation.basic).toBe(true);
        expect(result.featureMap.show_quantity.free).toBe(false);
        expect(result.featureMap.show_quantity.basic).toBe(true);
        expect(result.featureMap.custom_feature.free).toBe(true);
    });
});
