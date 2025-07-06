// src/routes/api/stats/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import { supabase } from '$lib/supabase.js';
import { applyGoalOverride } from '$lib/config.js';
import { getCurrentData } from '$lib/datamonitor.js';

interface StatsResponse {
    secRate: number;
    minRate: number;
    hourlyRate: number;
    dailyRate: number;
    peakHour: number;
    totalToday: number;
    timeToGoal: string;
    activityLevel: string;
    currentSignatures: number;
    goal: number;
}

function calculateSlidingWindowRate(data: any[], timeWindowMs: number): number {
    if (data.length === 0) return 0;
    
    const now = Date.now();
    const windowStart = now - timeWindowMs;
    
    // Filter data within the time window
    const windowData = data.filter(row => {
        const entryTime = new Date(row.timestamp).getTime();
        return entryTime > windowStart;
    });
    
    if (windowData.length === 0) return 0;
    
    // Sum only positive changes (new signatures)
    const totalChanges = windowData.reduce((sum, row) => {
        return sum + Math.max(0, row.change_amount);
    }, 0);
    
    // Calculate rate per unit time
    const actualWindowMs = Math.min(timeWindowMs, now - new Date(windowData[0].timestamp).getTime());
    return totalChanges > 0 ? (totalChanges / (actualWindowMs / 1000)) : 0;
}

function toCEST(date: Date): Date {
    return new Date(date.toLocaleString("en-US", { timeZone: "Europe/Oslo" }));
}

export const GET: RequestHandler = async () => {
    try {
        // Get current live data from datamonitor (most up-to-date)
        const currentLiveData = getCurrentData();
        
        // Get all recent data (last 25 hours to ensure we have complete 24h data)
        const hoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
        
        const { data: rawData, error } = await supabase
            .from('signature_snapshots')
            .select('*')
            .gte('timestamp', hoursAgo.toISOString())
            .order('timestamp', { ascending: true });

        if (error) {
            throw error;
        }

        if (!rawData || rawData.length === 0) {
            // Fallback to live data if no database data
            const fallbackSignatures = currentLiveData?.signatureCount || 0;
            const fallbackGoal = currentLiveData?.goal || 1500000;
            
            return new Response(JSON.stringify({
                secRate: 0,
                minRate: 0,
                hourlyRate: 0,
                dailyRate: 0,
                peakHour: 0,
                totalToday: 0,
                timeToGoal: 'No data',
                activityLevel: 'None',
                currentSignatures: fallbackSignatures,
                goal: fallbackGoal
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Apply goal override to all data
        const data = rawData.map(item => ({
            ...item,
            goal: applyGoalOverride({ goal: item.goal }).goal
        }));

        // Get current signature count and goal from latest entry OR live data (whichever is newer)
        const latestDbEntry = data[data.length - 1];
        const currentSignatures = currentLiveData?.signatureCount && currentLiveData.signatureCount >= latestDbEntry.signature_count 
            ? currentLiveData.signatureCount 
            : latestDbEntry.signature_count;
        const goal = currentLiveData?.goal || latestDbEntry.goal;

        console.log(`📊 Stats calculation - DB: ${latestDbEntry.signature_count}, Live: ${currentLiveData?.signatureCount}, Using: ${currentSignatures}`);

        // Calculate sliding window rates (using database data for historical analysis)
        const secRate = calculateSlidingWindowRate(data, 30 * 1000); // 30 seconds
        const minRate = calculateSlidingWindowRate(data, 5 * 60 * 1000) * 60; // 5 minutes, per minute
        const hourlyRate = calculateSlidingWindowRate(data, 60 * 60 * 1000) * 3600; // 1 hour, per hour
        const dailyRate = calculateSlidingWindowRate(data, 24 * 60 * 60 * 1000) * 86400; // 24 hours, per day

        // Calculate total signatures today (last 24 hours)
        const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const todayData = data.filter(row => {
            return new Date(row.timestamp).getTime() > dayAgo;
        });
        
        const totalToday = todayData.reduce((sum, row) => {
            return sum + Math.max(0, row.change_amount);
        }, 0);

        // Find peak hour from today's data using CEST
        const hourlyData: Record<number, number> = {};
        todayData.forEach(row => {
            const cestDate = toCEST(new Date(row.timestamp));
            const hour = cestDate.getHours();
            if (row.change_amount > 0) {
                hourlyData[hour] = (hourlyData[hour] || 0) + row.change_amount;
            }
        });
        
        let peakHour = 0;
        let peakCount = 0;
        Object.entries(hourlyData).forEach(([hour, count]) => {
            if (count > peakCount) {
                peakCount = count;
                peakHour = parseInt(hour);
            }
        });

        // Determine activity level
        let activityLevel = 'Minimal';
        if (secRate > 0.1) {
            activityLevel = 'High';
        } else if (minRate > 1) {
            activityLevel = 'Medium';
        } else if (hourlyRate > 10) {
            activityLevel = 'Low';
        }

        // Calculate time to goal using most appropriate rate
        let timeToGoal = 'Calculating...';
        const remaining = goal - currentSignatures;
        
        if (remaining <= 0) {
            timeToGoal = 'Goal reached!';
        } else if (secRate > 0.1) {
            // High activity - use per-second rate
            const secondsToGoal = remaining / secRate;
            if (secondsToGoal < 60) {
                timeToGoal = `${Math.round(secondsToGoal)} seconds`;
            } else if (secondsToGoal < 3600) {
                timeToGoal = `${Math.round(secondsToGoal / 60)} minutes`;
            } else {
                timeToGoal = `${Math.round(secondsToGoal / 3600)} hours`;
            }
        } else if (minRate > 0.1) {
            // Medium activity - use per-minute rate
            const minutesToGoal = remaining / (minRate / 60);
            if (minutesToGoal < 60) {
                timeToGoal = `${Math.round(minutesToGoal)} minutes`;
            } else if (minutesToGoal < 1440) {
                timeToGoal = `${Math.round(minutesToGoal / 60)} hours`;
            } else {
                timeToGoal = `${Math.round(minutesToGoal / 1440)} days`;
            }
        } else if (hourlyRate > 0.1) {
            // Low activity - use hourly rate
            const hoursToGoal = remaining / hourlyRate;
            if (hoursToGoal < 24) {
                timeToGoal = `${Math.round(hoursToGoal)} hours`;
            } else {
                timeToGoal = `${Math.round(hoursToGoal / 24)} days`;
            }
        } else if (dailyRate > 0) {
            // Very low activity - use daily rate
            const daysToGoal = remaining / dailyRate;
            timeToGoal = `${Math.round(daysToGoal)} days`;
        } else {
            timeToGoal = 'No recent activity';
        }

        const response: StatsResponse = {
            secRate: Math.round(secRate * 100) / 100, // 2 decimal places
            minRate: Math.round(minRate * 10) / 10,   // 1 decimal place
            hourlyRate: Math.round(hourlyRate),
            dailyRate: Math.round(dailyRate),
            peakHour,
            totalToday,
            timeToGoal,
            activityLevel,
            currentSignatures,
            goal
        };

        return new Response(JSON.stringify(response), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Stats calculation error:', error);
        return new Response(JSON.stringify({ error: 'Failed to calculate stats' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};