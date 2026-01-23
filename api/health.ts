import { createClient } from '@supabase/supabase-js';

/**
 * Health Check Endpoint for QookCommander
 * 
 * Purpose: Prevents Supabase free tier from pausing after 7 days of inactivity.
 * This endpoint makes a simple database query to keep the connection alive.
 * 
 * Usage: Set up an uptime monitoring service (e.g., UptimeRobot, Better Uptime, Cron-job.org)
 * to ping this endpoint every 12-24 hours.
 * 
 * URL: https://qook.in/api/health
 */

export default async function handler(req: any, res: any) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const startTime = Date.now();
    const healthStatus: {
        status: 'healthy' | 'degraded' | 'unhealthy';
        timestamp: string;
        checks: {
            database: { status: string; latency_ms?: number; error?: string };
            environment: { status: string; details?: string };
        };
        version: string;
    } = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
            database: { status: 'unknown' },
            environment: { status: 'unknown' }
        },
        version: '1.0.0'
    };

    // Check 1: Environment variables
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || (!supabaseServiceKey && !supabaseAnonKey)) {
        healthStatus.status = 'unhealthy';
        healthStatus.checks.environment = {
            status: 'error',
            details: 'Missing Supabase configuration'
        };
        return res.status(503).json(healthStatus);
    }

    healthStatus.checks.environment = { status: 'ok' };

    // Check 2: Database connectivity (using anon key for read-only check)
    try {
        const supabase = createClient(
            supabaseUrl,
            supabaseServiceKey || supabaseAnonKey!
        );

        const dbStartTime = Date.now();

        // Simple query to keep the database active
        // Using a lightweight count query on a table that exists
        const { count, error } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true });

        const dbLatency = Date.now() - dbStartTime;

        if (error) {
            healthStatus.status = 'degraded';
            healthStatus.checks.database = {
                status: 'error',
                latency_ms: dbLatency,
                error: error.message
            };
        } else {
            healthStatus.checks.database = {
                status: 'ok',
                latency_ms: dbLatency
            };
        }
    } catch (error: any) {
        healthStatus.status = 'unhealthy';
        healthStatus.checks.database = {
            status: 'error',
            error: error.message || 'Database connection failed'
        };
    }

    // Return appropriate status code based on health
    const statusCode = healthStatus.status === 'healthy' ? 200
        : healthStatus.status === 'degraded' ? 200
            : 503;

    return res.status(statusCode).json(healthStatus);
}
