import { createClient } from '@supabase/supabase-js';
import { authenticateSupabaseUser } from './supabaseAuth';

export class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

export function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new ApiError(500, `Server configuration missing: ${name}`);
    }
    return value;
}

export function getSupabaseAdminClient() {
    return createClient(
        requireEnv('VITE_SUPABASE_URL'),
        requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    );
}

export async function requireAuthenticatedUser(authHeader?: string | null): Promise<string> {
    const { userId } = await authenticateSupabaseUser(authHeader);
    if (!userId) {
        throw new ApiError(401, 'Authentication required');
    }
    return userId;
}

export function assertRequestUser(authUserId: string, requestUserId?: string | null): string {
    if (requestUserId && requestUserId !== authUserId) {
        throw new ApiError(403, 'Authenticated user does not match request user');
    }
    return authUserId;
}

export function getErrorStatus(error: unknown): number {
    return error instanceof ApiError ? error.status : 500;
}

export function getErrorMessage(error: unknown, fallback = 'Request failed'): string {
    if (error instanceof ApiError) {
        return error.message;
    }
    if (error instanceof Error && process.env.NODE_ENV !== 'production') {
        return error.message;
    }
    return fallback;
}

function getAllowedOrigins(): string[] {
    const configured = process.env.ALLOWED_ORIGINS
        ?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean) || [];

    return configured.length > 0
        ? configured
        : [
            'https://qook.in',
            'https://www.qook.in',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:4173',
            'http://127.0.0.1:4173',
        ];
}

export function resolveAllowedOrigin(origin?: string | null): string {
    const allowedOrigins = getAllowedOrigins();
    if (origin && allowedOrigins.includes(origin)) {
        return origin;
    }
    return allowedOrigins[0];
}

export function applyCors(req: any, res: any): void {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', resolveAllowedOrigin(req.headers?.origin));
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function edgeCorsHeaders(req: Request): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(req.headers.get('origin')),
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin',
    };
}
