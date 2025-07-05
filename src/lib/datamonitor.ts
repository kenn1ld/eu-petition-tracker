// src/lib/dataMonitor.ts
const EU_API = "https://eci.ec.europa.eu/045/public/api/report/progression";

let cachedData: any = null;
let lastSignatureCount: number | null = null;
let monitorInterval: NodeJS.Timeout | null = null;

// Elegant subscriber management with automatic cleanup
class SubscriberManager {
    private subscribers = new Set<(data: any) => void>();
    
    subscribe(callback: (data: any) => void) {
        this.subscribers.add(callback);
        
        // Send current data immediately
        cachedData && callback(cachedData);
        
        // Return unsubscribe function
        return () => {
            this.subscribers.delete(callback);
            console.log(`🗑️ Subscriber removed (${this.subscribers.size} remaining)`);
        };
    }
    
    notify(data: any) {
        if (this.subscribers.size === 0) return;
        
        console.log(`📡 Notifying ${this.subscribers.size} subscribers...`);
        
        // Use iterator to safely remove failed callbacks during iteration
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

async function checkForChanges() {
    try {
        const response = await fetch(EU_API);
        const data = await response.json();
        
        if (data.signatureCount === lastSignatureCount) {
            console.log(`No change: ${data.signatureCount} signatures (${subscriberManager.count} subscribers)`);
            return;
        }
        
        // Data changed - update and notify
        console.log(`🎉 Signatures changed: ${lastSignatureCount} → ${data.signatureCount}`);
        
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
    
    checkForChanges();
    monitorInterval = setInterval(checkForChanges, intervalMs);
}

export function stopMonitoring() {
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
    }
}