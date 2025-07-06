<!-- src/routes/+page.svelte -->
<script lang="ts">
import { onMount, onDestroy } from 'svelte';

// Real-time data
let liveData: any = null;
let lastUpdated: Date | null = null;
let connectionStatus = 'Connecting...';
let eventSource: EventSource;

// Historical data
let historicalData: any[] = [];
let chartData: any[] = [];
let stats = {
    avgPerHour: 0,
    peakHour: 0,
    totalToday: 0,
    timeToGoal: 'Calculating...'
};

async function fetchHistoricalData() {
    try {
        const response = await fetch('/api/history?hours=24');
        const result = await response.json();
        
        if (result.data) {
            historicalData = result.data;
            processChartData();
            calculateStats();
        }
    } catch (error) {
        console.error('Failed to fetch historical data:', error);
    }
}

function processChartData() {
    // Group data by hour for chart
    const hourlyData: Record<number, number[]> = {};
    
    historicalData.forEach(row => {
        const hour = new Date(row.timestamp).getHours();
        if (!hourlyData[hour]) {
            hourlyData[hour] = [];
        }
        hourlyData[hour].push(row.change_amount);
    });
    
    // Create chart data
    chartData = Object.entries(hourlyData).map(([hour, changes]) => ({
        hour: `${hour}:00`,
        signatures: (changes as number[]).reduce((sum: number, change: number) => sum + change, 0),
        count: changes.length
    })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
}

function calculateStats() {
    if (historicalData.length === 0) return;
    
    // Calculate signatures per hour
    const totalChanges = historicalData.reduce((sum, row) => sum + row.change_amount, 0);
    const hours = historicalData.length > 0 ? 
        (Date.now() - new Date(historicalData[0].timestamp).getTime()) / (1000 * 60 * 60) : 1;
    
    stats.avgPerHour = Math.round(totalChanges / Math.max(hours, 1));
    stats.totalToday = totalChanges;
    
    // Find peak hour
    const peakData = chartData.reduce((max, curr) => 
        curr.signatures > max.signatures ? curr : max, 
        { signatures: 0, hour: '0:00' }
    );
    stats.peakHour = parseInt(peakData.hour);
    
    // Estimate time to goal
    if (liveData && stats.avgPerHour > 0) {
        const remaining = liveData.goal - liveData.signatureCount;
        const hoursToGoal = remaining / stats.avgPerHour;
        if (hoursToGoal < 24) {
            stats.timeToGoal = `${Math.round(hoursToGoal)} hours`;
        } else {
            stats.timeToGoal = `${Math.round(hoursToGoal / 24)} days`;
        }
    }
}

async function fetchManualData() {
    const response = await fetch('/api/data');
    const result = await response.json();
    liveData = result.data;
    lastUpdated = new Date();
}

onMount(() => {
    // Fetch initial historical data
    fetchHistoricalData();
    
    // Set up real-time connection for live updates
    eventSource = new EventSource('/api/live-data');
    
    eventSource.onopen = () => {
        connectionStatus = '🟢 Live';
        console.log('Connected to live updates');
    };
    
    eventSource.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        if (message.data) {
            console.log('📨 Received live update!');
            liveData = message.data;
            lastUpdated = new Date(message.timestamp);
            
            // Refresh historical data every few updates
            if (Math.random() < 0.1) { // 10% chance each update
                fetchHistoricalData();
            }
        }
    };
    
    eventSource.onerror = () => {
        connectionStatus = '🔴 Disconnected';
        console.error('Connection lost');
    };
    
    // Refresh historical data every 5 minutes
    const refreshInterval = setInterval(fetchHistoricalData, 5 * 60 * 1000);
    
    return () => clearInterval(refreshInterval);
});

onDestroy(() => {
    if (eventSource) {
        eventSource.close();
    }
});

$: progressPercentage = liveData ? (liveData.signatureCount / liveData.goal) * 100 : 0;
$: remainingSignatures = liveData ? liveData.goal - liveData.signatureCount : 0;
</script>

<svelte:head>
    <title>EU Petition Tracker - Real-time Analytics</title>
</svelte:head>

<main class="container">
    <!-- Header -->
    <header class="header">
        <h1>🇪🇺 EU Petition Tracker</h1>
        <div class="status-bar">
            <span class="status">Status: {connectionStatus}</span>
            {#if lastUpdated}
                <span class="last-updated">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
            {/if}
        </div>
    </header>

    <!-- Live Data Section -->
    {#if liveData}
        <section class="live-section">
            <div class="signature-count">
                <h2>{liveData.signatureCount.toLocaleString()}</h2>
                <p>of {liveData.goal.toLocaleString()} signatures</p>
            </div>
            
            <div class="progress-container">
                <div class="progress-bar">
                    <div 
                        class="progress-fill" 
                        style="width: {Math.min(100, progressPercentage)}%"
                    ></div>
                </div>
                <div class="progress-text">
                    <span>{progressPercentage.toFixed(1)}% complete</span>
                    <span>{remainingSignatures.toLocaleString()} remaining</span>
                </div>
            </div>
        </section>
    {:else}
        <section class="live-section">
            <div class="loading">
                <p>Loading live data...</p>
            </div>
        </section>
    {/if}

    <!-- Stats Cards -->
    <section class="stats-grid">
        <div class="stat-card">
            <h3>📈 Hourly Rate</h3>
            <p class="stat-number">{stats.avgPerHour}</p>
            <span>signatures/hour</span>
        </div>
        
        <div class="stat-card">
            <h3>🔥 Peak Hour</h3>
            <p class="stat-number">{stats.peakHour}:00</p>
            <span>most active</span>
        </div>
        
        <div class="stat-card">
            <h3>📊 Today Total</h3>
            <p class="stat-number">{stats.totalToday}</p>
            <span>new signatures</span>
        </div>
        
        <div class="stat-card">
            <h3>⏰ Est. Completion</h3>
            <p class="stat-number">{stats.timeToGoal}</p>
            <span>at current rate</span>
        </div>
    </section>

    <!-- Hourly Chart -->
    {#if chartData.length > 0}
        <section class="chart-section">
            <h3>📈 Signatures by Hour (Last 24h)</h3>
            <div class="chart-container">
                {#each chartData as dataPoint}
                    <div class="chart-bar">
                        <div 
                            class="bar-fill" 
                            style="height: {Math.max(5, (dataPoint.signatures / Math.max(...chartData.map(d => d.signatures))) * 100)}%"
                        ></div>
                        <span class="bar-label">{dataPoint.hour}</span>
                        <span class="bar-value">{dataPoint.signatures}</span>
                    </div>
                {/each}
            </div>
        </section>
    {/if}

    <!-- Recent Activity -->
    {#if historicalData.length > 0}
        <section class="activity-section">
            <h3>🕐 Recent Activity</h3>
            <div class="activity-list">
                {#each historicalData.slice(-10).reverse() as entry}
                    <div class="activity-item">
                        <span class="activity-time">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        <span class="activity-change" class:positive={entry.change_amount > 0}>
                            +{entry.change_amount} signatures
                        </span>
                        <span class="activity-total">
                            Total: {entry.signature_count.toLocaleString()}
                        </span>
                    </div>
                {/each}
            </div>
        </section>
    {/if}

    <!-- Manual Controls -->
    <section class="controls">
        <button on:click={fetchManualData} class="refresh-btn">
            🔄 Manual Refresh
        </button>
        <button on:click={fetchHistoricalData} class="refresh-btn">
            📊 Refresh Analytics
        </button>
    </section>
</main>

<style>
.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}

.header {
    text-align: center;
    margin-bottom: 3rem;
}

.header h1 {
    font-size: 2.5rem;
    color: #1e40af;
    margin: 0 0 1rem 0;
}

.status-bar {
    display: flex;
    justify-content: center;
    gap: 2rem;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 0.5rem;
    font-size: 0.9rem;
    color: #64748b;
}

.live-section {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 3rem;
    border-radius: 1rem;
    text-align: center;
    margin-bottom: 3rem;
    box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
}

.signature-count h2 {
    font-size: 4rem;
    margin: 0;
    font-weight: bold;
}

.signature-count p {
    font-size: 1.2rem;
    margin: 0.5rem 0 2rem 0;
    opacity: 0.9;
}

.progress-container {
    max-width: 600px;
    margin: 0 auto;
}

.progress-bar {
    width: 100%;
    height: 20px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 1rem;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #059669);
    transition: width 0.8s ease;
    border-radius: 10px;
}

.progress-text {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    opacity: 0.9;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 3rem;
}

.stat-card {
    background: white;
    padding: 2rem;
    border-radius: 1rem;
    text-align: center;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    border: 1px solid #e2e8f0;
}

.stat-card h3 {
    font-size: 1rem;
    color: #64748b;
    margin: 0 0 1rem 0;
}

.stat-number {
    font-size: 2.5rem;
    font-weight: bold;
    color: #1e40af;
    margin: 0 0 0.5rem 0;
}

.stat-card span {
    color: #64748b;
    font-size: 0.9rem;
}

.chart-section {
    background: white;
    padding: 2rem;
    border-radius: 1rem;
    margin-bottom: 3rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.chart-section h3 {
    margin: 0 0 2rem 0;
    color: #1e40af;
}

.chart-container {
    display: flex;
    justify-content: space-between;
    align-items: end;
    height: 200px;
    gap: 0.5rem;
}

.chart-bar {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
}

.bar-fill {
    background: linear-gradient(to top, #3b82f6, #1d4ed8);
    width: 100%;
    border-radius: 4px 4px 0 0;
    min-height: 5px;
    transition: height 0.5s ease;
}

.bar-label {
    font-size: 0.8rem;
    color: #64748b;
    margin-top: 0.5rem;
}

.bar-value {
    font-size: 0.8rem;
    font-weight: bold;
    color: #1e40af;
}

.activity-section {
    background: white;
    padding: 2rem;
    border-radius: 1rem;
    margin-bottom: 3rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.activity-section h3 {
    margin: 0 0 1.5rem 0;
    color: #1e40af;
}

.activity-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.activity-item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 1rem;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 0.5rem;
    align-items: center;
}

.activity-time {
    font-size: 0.9rem;
    color: #64748b;
    font-family: monospace;
}

.activity-change {
    font-weight: bold;
    color: #059669;
}

.activity-total {
    font-size: 0.9rem;
    color: #64748b;
}

.controls {
    display: flex;
    gap: 1rem;
    justify-content: center;
}

.refresh-btn {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
}

.refresh-btn:hover {
    background: #1d4ed8;
}

.loading {
    padding: 2rem;
}

@media (max-width: 768px) {
    .container {
        padding: 1rem;
    }
    
    .header h1 {
        font-size: 2rem;
    }
    
    .signature-count h2 {
        font-size: 3rem;
    }
    
    .stats-grid {
        grid-template-columns: 1fr;
    }
    
    .status-bar {
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .progress-text {
        flex-direction: column;
        text-align: center;
        gap: 0.5rem;
    }
    
    .activity-item {
        grid-template-columns: 1fr;
        text-align: center;
    }
}
</style>