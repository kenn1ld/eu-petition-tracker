<script lang="ts">
import { onMount, onDestroy } from 'svelte';

let data: any = null;
let lastUpdated: Date | null = null;
let connectionStatus = 'Connecting...';
let eventSource: EventSource;

async function fetchData() {
    // Manual refresh using existing endpoint
    const response = await fetch('/api/data');
    const result = await response.json();
    data = result.data;
    lastUpdated = new Date();
}

onMount(() => {
    // Set up real-time connection
    eventSource = new EventSource('/api/data');
    
    eventSource.onopen = () => {
        connectionStatus = '🟢 Live';
        console.log('Connected to live updates');
    };
    
    eventSource.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        if (message.data) {
            console.log('📨 Received update from backend!');
            data = message.data;
            lastUpdated = new Date(message.timestamp);
        }
        // Ignore heartbeat messages
    };
    
    eventSource.onerror = () => {
        connectionStatus = '🔴 Disconnected';
        console.error('Connection lost');
    };
});

onDestroy(() => {
    if (eventSource) {
        eventSource.close();
    }
});
</script>

<main>
    <div class="status">
        Status: {connectionStatus}
        {#if lastUpdated}
            | Last updated: {lastUpdated.toLocaleTimeString()}
        {/if}
    </div>
    
    <button on:click={fetchData}>Manual Refresh</button>
    
    {#if data}
        <div class="signatures">
            <h2>{data.signatureCount?.toLocaleString()}</h2>
            <p>of {data.goal?.toLocaleString()} signatures</p>
        </div>
    {:else}
        <p>Waiting for data...</p>
    {/if}
</main>

<style>
.status {
    background: #f0f0f0;
    padding: 0.5rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
}

.signatures h2 {
    font-size: 2rem;
    color: #2563eb;
    margin: 0;
}
</style>