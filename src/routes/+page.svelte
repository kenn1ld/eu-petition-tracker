<!-- src/routes/+page.svelte -->
<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import { browser } from '$app/environment';
import { applyGoalOverride } from '$lib/config.js';

// Chart.js
let Chart: any;
let lineChart: any;
let doughnutChart: any;

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

// Chart elements
let lineChartCanvas: HTMLCanvasElement;
let doughnutChartCanvas: HTMLCanvasElement;

async function loadChartJS() {
    if (browser) {
        const chartModule = await import('chart.js/auto');
        Chart = chartModule.default;
    }
}

async function fetchHistoricalData() {
    try {
        const response = await fetch('/api/history?hours=24');
        const result = await response.json();
        
        if (result.data) {
            historicalData = result.data;
            processChartData();
            calculateStats();
            updateCharts();
        }
    } catch (error) {
        console.error('Failed to fetch historical data:', error);
        // Simulate data for demo
        simulateData();
    }
}

function simulateData() {
    // Generate demo data for showcase
    const now = new Date();
    historicalData = [];
    let signatureCount = 850000;
    
    for (let i = 24; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
        const change = Math.floor(Math.random() * 5000) + 1000;
        signatureCount += change;
        
        historicalData.push({
            timestamp: timestamp.toISOString(),
            signature_count: signatureCount,
            change_amount: change
        });
    }
    
    if (!liveData) {
        liveData = {
            signatureCount: signatureCount,
            goal: 1000000
        };
        lastUpdated = new Date();
    }
    
    processChartData();
    calculateStats();
    updateCharts();
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

function updateCharts() {
    if (!Chart || !chartData.length) return;
    
    updateLineChart();
    updateDoughnutChart();
}

function updateLineChart() {
    if (!lineChartCanvas) return;
    
    if (lineChart) {
        lineChart.destroy();
    }
    
    const ctx = lineChartCanvas.getContext('2d');
    if (!ctx) return;
    
    lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.map(d => d.hour),
            datasets: [{
                label: 'Signatures per Hour',
                data: chartData.map(d => d.signatures),
                borderColor: 'rgba(102, 126, 234, 1)',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: 'rgba(102, 126, 234, 1)',
                pointBorderColor: 'rgba(255, 255, 255, 1)',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: false
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {
                            size: 12
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {
                            size: 12
                        }
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function updateDoughnutChart() {
    if (!doughnutChartCanvas || !liveData) return;
    
    if (doughnutChart) {
        doughnutChart.destroy();
    }
    
    const ctx = doughnutChartCanvas.getContext('2d');
    if (!ctx) return;
    
    const progressPercentage = (liveData.signatureCount / liveData.goal) * 100;
    const remaining = 100 - progressPercentage;
    
    doughnutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Remaining'],
            datasets: [{
                data: [progressPercentage, remaining],
                backgroundColor: [
                    'rgba(16, 185, 129, 1)',
                    'rgba(255, 255, 255, 0.1)'
                ],
                borderColor: [
                    'rgba(16, 185, 129, 1)',
                    'rgba(255, 255, 255, 0.2)'
                ],
                borderWidth: 2,
                cutout: '70%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context: any) {
                            return context.label + ': ' + context.parsed.toFixed(1) + '%';
                        }
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

async function fetchManualData() {
    try {
        const response = await fetch('/api/current');
        const result = await response.json();
        liveData = result.data;
        lastUpdated = new Date(result.timestamp);
        updateCharts();
        console.log('🔄 Manual refresh completed with goal:', result.data?.goal);
    } catch (error) {
        console.error('Failed to fetch manual data:', error);
        simulateData();
    }
}

onMount(async () => {
    await loadChartJS();
    
    // Fetch initial historical data
    fetchHistoricalData();
    
    // Set up real-time connection for live updates
    try {
        eventSource = new EventSource('/api/data');
        
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
    } catch (error) {
        console.error('EventSource not available:', error);
        connectionStatus = '🟡 Demo Mode';
        simulateData();
    }
    
    // Refresh historical data every 5 minutes
    const refreshInterval = setInterval(fetchHistoricalData, 5 * 60 * 1000);
    
    // Return cleanup function
    return () => {
        clearInterval(refreshInterval);
    };
});

onDestroy(() => {
    if (eventSource) {
        eventSource.close();
    }
    if (lineChart) {
        lineChart.destroy();
    }
    if (doughnutChart) {
        doughnutChart.destroy();
    }
});

$: progressPercentage = liveData ? (liveData.signatureCount / liveData.goal) * 100 : 0;
$: remainingSignatures = liveData ? liveData.goal - liveData.signatureCount : 0;
</script>

<svelte:head>
    <title>EU Petition Tracker - Real-time Analytics</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
        
        .glass {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .gradient-bg {
            background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #533483 100%);
        }
        
        .gradient-text {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .progress-shimmer::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
            animation: shimmer 2s infinite;
        }
        
        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .animate-fadeInUp {
            animation: fadeInUp 0.8s ease-out;
        }
        
        .animate-fadeInUp-delay-1 {
            animation: fadeInUp 0.8s ease-out 0.2s both;
        }
        
        .animate-fadeInUp-delay-2 {
            animation: fadeInUp 0.8s ease-out 0.4s both;
        }
        
        .animate-fadeInUp-delay-3 {
            animation: fadeInUp 0.8s ease-out 0.6s both;
        }
        
        .animate-fadeInUp-delay-4 {
            animation: fadeInUp 0.8s ease-out 0.8s both;
        }
        
        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
                        radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.15) 0%, transparent 50%),
                        radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.1) 0%, transparent 50%);
            pointer-events: none;
            z-index: -1;
        }
    </style>
</svelte:head>

<main class="min-h-screen gradient-bg">
    <div class="container mx-auto px-4 py-8 max-w-7xl">
        <!-- Header -->
        <header class="text-center mb-12 animate-fadeInUp">
            <h1 class="text-4xl md:text-6xl font-black mb-6 gradient-text tracking-tight">
                🇪🇺 EU Petition Tracker
            </h1>
            <div class="glass rounded-full px-6 py-3 inline-flex items-center gap-4 text-slate-300">
                <span class="flex items-center gap-2">
                    <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    Status: {connectionStatus}
                </span>
                {#if lastUpdated}
                    <span class="text-sm">
                        Last updated: {lastUpdated.toLocaleTimeString()}
                    </span>
                {/if}
            </div>
        </header>

        <!-- Live Data Section -->
        {#if liveData}
            <section class="glass rounded-3xl p-8 md:p-12 text-center mb-12 relative overflow-hidden animate-fadeInUp-delay-1">
                <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
                
                <div class="mb-8">
                    <h2 class="text-5xl md:text-7xl font-black mb-2 text-white tracking-tight">
                        {liveData.signatureCount.toLocaleString()}
                    </h2>
                    <p class="text-xl text-slate-300">
                        of {liveData.goal.toLocaleString()} signatures
                    </p>
                </div>
                
                <div class="max-w-2xl mx-auto">
                    <div class="relative w-full h-3 bg-white/10 rounded-full overflow-hidden mb-4">
                        <div 
                            class="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-1000 ease-out relative progress-shimmer"
                            style="width: {Math.min(100, progressPercentage)}%"
                        ></div>
                    </div>
                    <div class="flex flex-col md:flex-row justify-between text-sm text-slate-300 gap-2">
                        <span class="font-medium">{progressPercentage.toFixed(1)}% complete</span>
                        <span>{remainingSignatures.toLocaleString()} remaining</span>
                    </div>
                </div>
            </section>
        {:else}
            <section class="glass rounded-3xl p-12 text-center mb-12 animate-fadeInUp-delay-1">
                <div class="animate-spin w-8 h-8 border-2 border-white/20 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                <p class="text-slate-300">Loading live data...</p>
            </section>
        {/if}

        <!-- Stats Cards -->
        <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 animate-fadeInUp-delay-2">
            <div class="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform duration-300 group">
                <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                <h3 class="text-sm text-slate-400 mb-4 font-medium">📈 Hourly Rate</h3>
                <p class="text-3xl font-bold gradient-text mb-1">{stats.avgPerHour}</p>
                <span class="text-slate-400 text-sm">signatures/hour</span>
            </div>
            
            <div class="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform duration-300 group">
                <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                <h3 class="text-sm text-slate-400 mb-4 font-medium">🔥 Peak Hour</h3>
                <p class="text-3xl font-bold gradient-text mb-1">{stats.peakHour}:00</p>
                <span class="text-slate-400 text-sm">most active</span>
            </div>
            
            <div class="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform duration-300 group">
                <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                <h3 class="text-sm text-slate-400 mb-4 font-medium">📊 Today Total</h3>
                <p class="text-3xl font-bold gradient-text mb-1">{stats.totalToday}</p>
                <span class="text-slate-400 text-sm">new signatures</span>
            </div>
            
            <div class="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform duration-300 group">
                <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                <h3 class="text-sm text-slate-400 mb-4 font-medium">⏰ Est. Completion</h3>
                <p class="text-3xl font-bold gradient-text mb-1">{stats.timeToGoal}</p>
                <span class="text-slate-400 text-sm">at current rate</span>
            </div>
        </section>

        <!-- Charts Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            <!-- Line Chart -->
            <div class="lg:col-span-2 glass rounded-2xl p-6 animate-fadeInUp-delay-3">
                <h3 class="text-xl font-semibold text-white mb-6">📈 Signatures by Hour (Last 24h)</h3>
                <div class="relative h-80">
                    <canvas bind:this={lineChartCanvas}></canvas>
                </div>
            </div>
            
            <!-- Progress Doughnut Chart -->
            <div class="glass rounded-2xl p-6 flex flex-col items-center justify-center animate-fadeInUp-delay-3">
                <h3 class="text-xl font-semibold text-white mb-6">🎯 Progress Overview</h3>
                <div class="relative h-48 w-48">
                    <canvas bind:this={doughnutChartCanvas}></canvas>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="text-center">
                            <div class="text-2xl font-bold text-white">{progressPercentage.toFixed(1)}%</div>
                            <div class="text-sm text-slate-400">Complete</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Recent Activity -->
        {#if historicalData.length > 0}
            <section class="glass rounded-2xl p-6 mb-12 animate-fadeInUp-delay-4">
                <h3 class="text-xl font-semibold text-white mb-6">🕐 Recent Activity</h3>
                <div class="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {#each historicalData.slice(-10).reverse() as entry}
                        <div class="glass rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 items-center hover:bg-white/10 transition-colors">
                            <span class="text-sm text-slate-400 font-mono">
                                {new Date(entry.timestamp).toLocaleTimeString()}
                            </span>
                            <span class="font-semibold text-green-400">
                                +{entry.change_amount} signatures
                            </span>
                            <span class="text-sm text-slate-300 text-right">
                                Total: {entry.signature_count.toLocaleString()}
                            </span>
                        </div>
                    {/each}
                </div>
            </section>
        {/if}

        <!-- Manual Controls -->
        <section class="flex flex-col md:flex-row gap-4 justify-center items-center animate-fadeInUp-delay-4">
            <button 
                on:click={fetchManualData} 
                class="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg border border-white/10"
            >
                🔄 Manual Refresh
            </button>
            <button 
                on:click={fetchHistoricalData} 
                class="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg border border-white/10"
            >
                📊 Refresh Analytics
            </button>
        </section>
    </div>
</main>