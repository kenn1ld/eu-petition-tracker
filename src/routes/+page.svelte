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

// Real-time update interval
let updateInterval: ReturnType<typeof setInterval>;

async function loadChartJS() {
    if (browser) {
        const chartModule = await import('chart.js/auto');
        Chart = chartModule.default;
    }
}

async function fetchHistoricalData() {
    try {
        // Fetch ALL historical data, not just 24 hours
        const response = await fetch('/api/history?hours=all');
        const result = await response.json();
        
        if (result.data) {
            historicalData = result.data;
            processChartData();
            calculateStats();
            updateCharts();
        }
    } catch (error) {
        console.error('Failed to fetch historical data:', error);
    }
}

function processChartData() {
    if (historicalData.length === 0) return;
    
    // Group data by time periods for better visualization
    const timeGroups: Record<string, number[]> = {};
    
    historicalData.forEach(row => {
        const date = new Date(row.timestamp);
        // Group by hour for recent data, by day for older data
        const isRecent = Date.now() - date.getTime() < 24 * 60 * 60 * 1000;
        
        let key: string;
        if (isRecent) {
            key = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
        } else {
            key = `${date.getMonth() + 1}/${date.getDate()}`;
        }
        
        if (!timeGroups[key]) {
            timeGroups[key] = [];
        }
        timeGroups[key].push(row.change_amount);
    });
    
    // Create chart data
    chartData = Object.entries(timeGroups).map(([time, changes]) => ({
        time,
        signatures: (changes as number[]).reduce((sum: number, change: number) => sum + change, 0),
        count: changes.length
    })).sort((a, b) => {
        // Sort by time
        const aTime = new Date(a.time);
        const bTime = new Date(b.time);
        return aTime.getTime() - bTime.getTime();
    });
    
    // Keep only last 50 data points for performance
    if (chartData.length > 50) {
        chartData = chartData.slice(-50);
    }
}

function calculateStats() {
    if (historicalData.length === 0) return;
    
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);
    
    // Calculate today's signatures
    const todayData = historicalData.filter(row => 
        new Date(row.timestamp).getTime() > dayAgo
    );
    
    const totalChanges = todayData.reduce((sum, row) => sum + row.change_amount, 0);
    const hours = todayData.length > 0 ? 
        (now - Math.max(...todayData.map(r => new Date(r.timestamp).getTime()))) / (1000 * 60 * 60) : 1;
    
    stats.avgPerHour = Math.round(totalChanges / Math.max(hours, 1));
    stats.totalToday = totalChanges;
    
    // Find peak hour from recent data
    const hourlyData: Record<number, number> = {};
    todayData.forEach(row => {
        const hour = new Date(row.timestamp).getHours();
        hourlyData[hour] = (hourlyData[hour] || 0) + row.change_amount;
    });
    
    let peakHour = 0;
    let peakCount = 0;
    Object.entries(hourlyData).forEach(([hour, count]) => {
        if (count > peakCount) {
            peakCount = count;
            peakHour = parseInt(hour);
        }
    });
    stats.peakHour = peakHour;
    
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
    
    const ctx = lineChartCanvas.getContext('2d');
    if (!ctx) return;
    
    // Update existing chart data instead of destroying/recreating
    if (lineChart) {
        lineChart.data.labels = chartData.map(d => d.time);
        lineChart.data.datasets[0].data = chartData.map(d => d.signatures);
        lineChart.update('none'); // No animation for smooth updates
    } else {
        lineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.map(d => d.time),
                datasets: [{
                    label: 'Signatures',
                    data: chartData.map(d => d.signatures),
                    borderColor: 'rgba(102, 126, 234, 1)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: 'rgba(102, 126, 234, 1)',
                    pointBorderColor: 'rgba(255, 255, 255, 1)',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
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
                            },
                            maxTicksLimit: 10
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
                    duration: 0 // No animation for smooth real-time updates
                }
            }
        });
    }
}

function updateDoughnutChart() {
    if (!doughnutChartCanvas || !liveData) return;
    
    const ctx = doughnutChartCanvas.getContext('2d');
    if (!ctx) return;
    
    const progressPercentage = (liveData.signatureCount / liveData.goal) * 100;
    const remaining = 100 - progressPercentage;
    
    // Update existing chart data instead of destroying/recreating
    if (doughnutChart) {
        doughnutChart.data.datasets[0].data = [progressPercentage, remaining];
        doughnutChart.update('none'); // No animation for smooth updates
    } else {
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
                    duration: 0 // No animation for smooth real-time updates
                }
            }
        });
    }
}

onMount(() => {
    (async () => {
        await loadChartJS();

        // Fetch initial historical data
        await fetchHistoricalData();

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
                    
                    // Update charts and stats immediately
                    calculateStats();
                    updateCharts();
                }
            };

            eventSource.onerror = () => {
                connectionStatus = '🔴 Disconnected';
                console.error('Connection lost');
            };
        } catch (error) {
            console.error('EventSource not available:', error);
        }

        // Update everything every second for smooth real-time experience
        updateInterval = setInterval(() => {
            if (liveData) {
                // Refresh historical data every 30 seconds
                if (Date.now() % 30000 < 1000) {
                    fetchHistoricalData();
                }
                
                // Update charts and stats every second
                calculateStats();
                updateCharts();
            }
        }, 1000);
    })();
});

onDestroy(() => {
    if (updateInterval) clearInterval(updateInterval);
    if (eventSource) eventSource.close();
    if (lineChart) lineChart.destroy();
    if (doughnutChart) doughnutChart.destroy();
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
        
        .progress-shimmer {
            position: relative;
            overflow: hidden;
        }
        
        .progress-shimmer::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
            animation: shimmer 3s infinite;
        }
        
        @keyframes shimmer {
            0% { left: -100%; }
            100% { left: 100%; }
        }
        
        .pulse-dot {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.05); }
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
        
        .stat-card {
            transition: all 0.3s ease;
        }
        
        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
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
                    <div class="w-2 h-2 bg-green-400 rounded-full pulse-dot"></div>
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
                            class="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500 ease-out progress-shimmer"
                            style="width: {Math.min(100, progressPercentage)}%"
                        ></div>
                    </div>
                    <div class="flex flex-col md:flex-row justify-between text-sm text-slate-300 gap-2">
                        <span class="font-medium">{progressPercentage.toFixed(2)}% complete</span>
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
            <div class="stat-card glass rounded-2xl p-6 text-center relative">
                <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                <h3 class="text-sm text-slate-400 mb-4 font-medium">📈 Hourly Rate</h3>
                <p class="text-3xl font-bold gradient-text mb-1">{stats.avgPerHour.toLocaleString()}</p>
                <span class="text-slate-400 text-sm">signatures/hour</span>
            </div>
            
            <div class="stat-card glass rounded-2xl p-6 text-center relative">
                <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                <h3 class="text-sm text-slate-400 mb-4 font-medium">🔥 Peak Hour</h3>
                <p class="text-3xl font-bold gradient-text mb-1">{stats.peakHour}:00</p>
                <span class="text-slate-400 text-sm">most active</span>
            </div>
            
            <div class="stat-card glass rounded-2xl p-6 text-center relative">
                <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                <h3 class="text-sm text-slate-400 mb-4 font-medium">📊 Today Total</h3>
                <p class="text-3xl font-bold gradient-text mb-1">{stats.totalToday.toLocaleString()}</p>
                <span class="text-slate-400 text-sm">new signatures</span>
            </div>
            
            <div class="stat-card glass rounded-2xl p-6 text-center relative">
                <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                <h3 class="text-sm text-slate-400 mb-4 font-medium">⏰ Est. Completion</h3>
                <p class="text-2xl font-bold gradient-text mb-1">{stats.timeToGoal}</p>
                <span class="text-slate-400 text-sm">at current rate</span>
            </div>
        </section>

        <!-- Charts Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            <!-- Line Chart -->
            <div class="lg:col-span-2 glass rounded-2xl p-6 animate-fadeInUp-delay-3">
                <h3 class="text-xl font-semibold text-white mb-6">📈 Signature Activity Over Time</h3>
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
                    {#each historicalData.slice(-15).reverse() as entry}
                        <div class="glass rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 items-center hover:bg-white/10 transition-colors">
                            <span class="text-sm text-slate-400 font-mono">
                                {new Date(entry.timestamp).toLocaleString()}
                            </span>
                            <span class="font-semibold text-green-400">
                                +{entry.change_amount.toLocaleString()} signatures
                            </span>
                            <span class="text-sm text-slate-300 text-right">
                                Total: {entry.signature_count.toLocaleString()}
                            </span>
                        </div>
                    {/each}
                </div>
            </section>
        {/if}
    </div>
</main>