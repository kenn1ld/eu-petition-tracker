import type { RequestHandler } from '@sveltejs/kit';
import { supabase } from '$lib/supabase.js';
import { applyGoalOverride } from '$lib/config.js';

export const GET: RequestHandler = async ({ url }) => {
    const hours = url.searchParams.get('hours');
    
    try {
        let query = supabase
            .from('signature_snapshots')
            .select('*')
            .order('timestamp', { ascending: true });

        // Only apply time filter if hours parameter is provided
        if (hours && hours !== 'all') {
            const hoursAgo = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
            query = query.gte('timestamp', hoursAgo.toISOString());
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        // 🎯 Apply goal override to all historical data
        const dataWithOverriddenGoals = data?.map(item => ({
            ...item,
            goal: applyGoalOverride({ goal: item.goal }).goal
        })) || [];

        return new Response(JSON.stringify({
            data: dataWithOverriddenGoals,
            count: dataWithOverriddenGoals.length
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Database query error:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};