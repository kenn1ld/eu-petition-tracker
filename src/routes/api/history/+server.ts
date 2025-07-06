import type { RequestHandler } from '@sveltejs/kit';
import { supabase } from '$lib/supabase.js';

export const GET: RequestHandler = async ({ url }) => {
    const hours = url.searchParams.get('hours') || '24';
    
    try {
        const { data, error } = await supabase
            .from('signature_snapshots')
            .select('*')
            .gte('timestamp', new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000).toISOString())
            .order('timestamp', { ascending: true });

        if (error) {
            throw error;
        }

        return new Response(JSON.stringify({
            data,
            count: data?.length || 0
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