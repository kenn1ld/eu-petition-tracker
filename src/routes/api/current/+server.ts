import type { RequestHandler } from '@sveltejs/kit';
import { getCurrentData } from '$lib/datamonitor';

export const GET: RequestHandler = async () => {
    const currentData = getCurrentData();
    
    if (!currentData) {
        return new Response(JSON.stringify({ 
            error: 'No data available' 
        }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({
        data: currentData,
        timestamp: Date.now()
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
};