// src/routes/api/live-data/+server.ts
import type { RequestHandler } from './$types';
import { subscribeToDataChanges, startMonitoring } from '$lib/dataMonitor';

let connectionCount = 0;
let monitoringStarted = false;

export const GET: RequestHandler = async () => {
    // Start monitoring on first connection
    if (!monitoringStarted) {
        console.log('🚀 Starting data monitoring...');
        startMonitoring(1000);
        monitoringStarted = true;
    }

    return new Response(
        new ReadableStream({
            start(controller) {
                connectionCount++;
                console.log(`📡 New frontend connected (${connectionCount} total)`);
                
                let isConnected = true;
                
                // Send data safely, auto-cleanup on failure
                const send = (data: string): boolean => {
                    if (!isConnected) return false;
                    
                    try {
                        controller.enqueue(data);
                        return true;
                    } catch {
                        cleanup();
                        return false;
                    }
                };
                
                // Cleanup everything
                const cleanup = () => {
                    if (!isConnected) return;
                    
                    isConnected = false;
                    connectionCount--;
                    unsubscribe?.();
                    clearInterval(heartbeat);
                    
                    console.log(`🧹 Connection cleaned up (${connectionCount} remaining)`);
                };
                
                // Subscribe to data updates
                const unsubscribe = subscribeToDataChanges((newData: any) => {
                    const success = send(`data: ${JSON.stringify({
                        data: newData,
                        timestamp: Date.now()
                    })}\n\n`);
                    
                    if (success) {
                        console.log('📤 Pushed update to frontend');
                    }
                });
                
                // Heartbeat to keep connection alive
                const heartbeat = setInterval(() => {
                    send(`data: ${JSON.stringify({
                        type: 'heartbeat',
                        timestamp: Date.now()
                    })}\n\n`);
                }, 30000);
                
                return cleanup;
            }
        }),
        {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        }
    );
};