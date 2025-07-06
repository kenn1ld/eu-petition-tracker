// src/lib/datamonitor.ts
import { supabase, hasValidSupabase } from './supabase.js';
import { GOAL_OVERRIDE, applyGoalOverride } from './config.js';

const EU_API = "https://eci.ec.europa.eu/045/public/api/report/progression";

let cachedData: any = null;
let lastSignatureCount: number | null = null;
let monitorInterval: NodeJS.Timeout | null = null;

class SubscriberManager {
    private subscribers = new Set<(data: any) => void>();
    
    subscribe(callback: (data: any) => void) {
        this.subscribers.add(callback);
        cachedData && callback(cachedData);
        
        return () => {
            this.subscribers.delete(callback);
            console.log(`🗑️ Subscriber removed (${this.subscribers.size} remaining)`);
        };
    }
    
    notify(data: any) {
        if (this.subscribers.size === 0) return;
        
        console.log(`📡 Notifying ${this.subscribers.size} subscribers...`);
        
        for (const callback of this.subscribers) {
            try {
                callback(data);
            } catch (error) {
                console.error('Removing failed subscriber:', error);
                this.subscribers.delete(callback);
            }
        }
    }
    
    get count() {
        return this.subscribers.size;
    }
}

const subscriberManager = new SubscriberManager();

export const subscribeToDataChanges = (callback: (data: any) => void) => 
    subscriberManager.subscribe(callback);

export const getCurrentData = () => cachedData;

async function saveToSupabase(data: any, changeAmount: number) {
    if (!hasValidSupabase) {
        console.log('📊 Skipping Supabase save (build mode)');
        return;
    }

    try {
        const { error } = await supabase
            .from('signature_snapshots')
            .insert({
                signature_count: data.signatureCount,
                goal: data.goal, // This will now be the overridden goal
                change_amount: changeAmount
            });

        if (error) {
            console.error('Supabase save error:', error);
        } else {
            console.log('📊 Data saved to Supabase with overridden goal');
        }
    } catch (error) {
        console.error('Failed to save to Supabase:', error);
    }
}

async function checkForChanges() {
    try {
        const response = await fetch(EU_API);
        const rawData = await response.json();
        
        // 🎯 Apply goal override using the config
        const data = applyGoalOverride(rawData);
        
        console.log(`🎯 Goal overridden: ${rawData.goal || 'undefined'} → ${GOAL_OVERRIDE}`);
        
        if (data.signatureCount === lastSignatureCount) {
            console.log(`No change: ${data.signatureCount} signatures (${subscriberManager.count} subscribers)`);
            return;
        }
        
        // Calculate change amount
        const changeAmount = lastSignatureCount ? 
            data.signatureCount - lastSignatureCount : 0;
        
        console.log(`🎉 Signatures changed: ${lastSignatureCount} → ${data.signatureCount} (+${changeAmount})`);
        console.log(`📈 Progress: ${((data.signatureCount / data.goal) * 100).toFixed(2)}% of ${data.goal.toLocaleString()}`);
        
        // Save to Supabase
        await saveToSupabase(data, changeAmount);
        
        lastSignatureCount = data.signatureCount;
        cachedData = data;
        
        subscriberManager.notify(data);
        
    } catch (error) {
        console.error('Error checking for changes:', error);
    }
}

export function startMonitoring(intervalMs = 1000) {
    if (monitorInterval) return;
    
    console.log(`🚀 Starting monitoring every ${intervalMs/1000} seconds...`);
    console.log(`🎯 Goal manually set to: ${GOAL_OVERRIDE.toLocaleString()}`);
    
    checkForChanges();
    monitorInterval = setInterval(checkForChanges, intervalMs);
}

export function stopMonitoring() {
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
    }
}