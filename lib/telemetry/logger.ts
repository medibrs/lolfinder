import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export interface ApiMetricParams {
    endpoint: string;
    method: string;
    statusCode: number;
    responseTimeMs: number;
}

export async function logApiMetric(
    request: NextRequest | Request,
    params: ApiMetricParams
) {
    try {
        const supabase = await createClient();

        let ip = '127.0.0.1';
        let userAgent = 'Unknown';

        if (request.headers && typeof request.headers.get === 'function') {
            ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
            userAgent = request.headers.get('user-agent') || 'Unknown';
        }

        const { data: { user } } = await supabase.auth.getUser();

        // Log the API statistics directly to the database
        await supabase.from('api_metrics_logs').insert({
            ...params,
            user_id: user?.id || null,
            ip_address: ip,
            user_agent: userAgent
        });
    } catch (err) {
        // Analytics failures should never crash an endpoint completely
        console.error('Error logging API metric to database:', err);
    }
}

// ----------------------------------------------------------------------
// Admin / Analytics Utility Functions Below
// ----------------------------------------------------------------------

export async function getEndpointMetrics(endpoint: string, hoursAgo: number = 24) {
    const supabase = await createClient();
    const timeWindow = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

    // Example analytical query to give admins context
    const { data, error } = await supabase
        .from('api_metrics_logs')
        .select('status_code, response_time_ms')
        .eq('endpoint', endpoint)
        .gte('created_at', timeWindow);

    if (error || !data) return null;

    const totalRequests = data.length;
    const avgResponseTime = totalRequests > 0
        ? data.reduce((sum, row) => sum + (row.response_time_ms || 0), 0) / totalRequests
        : 0;
    const errorCount = data.filter(row => row.status_code >= 400).length;

    return {
        totalRequests,
        avgResponseTimeMs: Math.round(avgResponseTime),
        errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0
    };
}
