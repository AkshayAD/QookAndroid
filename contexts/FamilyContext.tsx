/**
 * Family Context
 * Provides app-wide family mode state and credit pool integration
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
    FamilyGroup,
    FamilyMember,
    FamilyCreditPool,
    getUserFamilyGroup,
    getFamilyMembers,
    getFamilyCreditPool,
    subscribeToFamilyGroup,
    isFamilyOwner
} from '../services/familyService';

interface FamilyContextType {
    familyGroup: FamilyGroup | null;
    members: FamilyMember[];
    isInFamily: boolean;
    isOwner: boolean;
    loading: boolean;
    isFamilyModeActive: boolean;
    toggleFamilyMode: () => void;
    setFamilyModeActive: (active: boolean) => void;
    familyCredits: number;
    refreshFamily: () => Promise<void>;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);
const FAMILY_MODE_STORAGE_KEY = 'qook_family_mode_active_v2';

export function FamilyProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [familyGroup, setFamilyGroup] = useState<FamilyGroup | null>(null);
    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [creditPool, setCreditPool] = useState<FamilyCreditPool | null>(null);
    const [isOwner, setIsOwner] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isFamilyModeActive, setIsFamilyModeActive] = useState<boolean>(() => {
        const saved = localStorage.getItem(FAMILY_MODE_STORAGE_KEY);
        return saved !== null ? saved === 'true' : false;
    });

    const loadFamilyData = async () => {
        if (!user?.id) {
            setFamilyGroup(null);
            setMembers([]);
            setCreditPool(null);
            setIsOwner(false);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const group = await getUserFamilyGroup();
            setFamilyGroup(group);

            if (group) {
                const [memberList, pool, ownerStatus] = await Promise.all([
                    getFamilyMembers(group.id),
                    getFamilyCreditPool(group.id),
                    isFamilyOwner()
                ]);
                setMembers(memberList);
                setCreditPool(pool);
                setIsOwner(ownerStatus);
            } else {
                setMembers([]);
                setCreditPool(null);
                setIsOwner(false);
            }
        } catch (error) {
            console.error('Error loading family data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFamilyData();
    }, [user?.id]);

    useEffect(() => {
        if (!familyGroup?.id) return;

        const unsubscribe = subscribeToFamilyGroup(
            familyGroup.id,
            (newMembers) => setMembers(newMembers),
            (newPool) => setCreditPool(newPool)
        );

        return () => unsubscribe();
    }, [familyGroup?.id]);

    const refreshFamily = async () => {
        await loadFamilyData();
    };

    const toggleFamilyMode = () => {
        if (!familyGroup?.is_active) return;
        const newValue = !isFamilyModeActive;
        setIsFamilyModeActive(newValue);
        localStorage.setItem(FAMILY_MODE_STORAGE_KEY, String(newValue));
    };

    const setFamilyModeActiveHandler = (active: boolean) => {
        if (!familyGroup?.is_active && active) return;
        setIsFamilyModeActive(active);
        localStorage.setItem(FAMILY_MODE_STORAGE_KEY, String(active));
    };

    const value: FamilyContextType = {
        familyGroup,
        members,
        isInFamily: !!familyGroup?.is_active,
        isOwner,
        loading,
        isFamilyModeActive: !!familyGroup?.is_active && isFamilyModeActive,
        toggleFamilyMode,
        setFamilyModeActive: setFamilyModeActiveHandler,
        familyCredits: creditPool?.total_credits ?? 0,
        refreshFamily
    };

    return (
        <FamilyContext.Provider value={value}>
            {children}
        </FamilyContext.Provider>
    );
}

export function useFamily() {
    const context = useContext(FamilyContext);
    if (context === undefined) {
        return {
            familyGroup: null,
            members: [],
            isInFamily: false,
            isOwner: false,
            loading: false,
            isFamilyModeActive: false,
            toggleFamilyMode: () => { },
            setFamilyModeActive: () => { },
            familyCredits: 0,
            refreshFamily: async () => { }
        };
    }
    return context;
}

export function useActiveFamilyGroupId(): string | null {
    const { isInFamily, isFamilyModeActive, familyGroup } = useFamily();
    if (isInFamily && isFamilyModeActive && familyGroup) {
        return familyGroup.id;
    }
    return null;
}
