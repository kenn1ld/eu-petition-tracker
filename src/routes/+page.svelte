<!-- src/routes/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { processChartData, calculateStats, simulateData } from '$lib/utils/dataProcessor.js';
    
    // Components
    import Header from '$lib/components/Header.svelte';
    import LiveDataSection from '$lib/components/LiveDataSection.svelte';
    import StatsGrid from '$lib/components/StatsGrid.svelte';
    import ChartsGrid from '$lib/components/ChartsGrid.svelte';
    import RecentActivity from '$lib/components/RecentActivity.svelte';
    import ControlButtons from '$lib/components/ControlButtons.svelte';
    
    // State
    let liveData: any = null;
    let lastUpdated: Date | null = null;
    let connectionStatus = 'Connecting...';
    let eventSource: EventSource;
    let historicalData: any[] = [];
    let chartData: any[] = [];
    let stats = {
        avgPerHour: 0,
        peakHour: 0,
        totalToday: 0,
        timeToGoal: 'Calculating...'
    };
    
    // Chart references
    let chartsGrid: ChartsGrid;
    
    // Computed values
    $: progressPercentage = liveData ? (liveData.signatureCount / liveData.goal) * 100 : 0;
    $: remainingSignatures = liveData ? liveData.goal - liveData.signatureCount : 0;
    
    async function fetchHistoricalData() {
        try {
            const response = await fetch('/api/history?hours=24');
            const result = await response.json();
            
            if (result.data) {
                historicalData = result.data;
                chartData = processChartData(historicalData);
                stats = calculateStats(historicalData, chartData, liveData);
                chartsGrid?.updateCharts();
            }
        } catch (error) {
            console.error('Failed to fetch historical data:', error);
            handleSimulateData();
        }
    }
    
    function handleSimulateData() {
        const simData = simulateData();
        historicalData = simData.historicalData;
        liveData = simData.liveData;
        lastUpdated = new Date();
        
        chartData = processChartData(historicalData);
        stats = calculateStats(historicalData, chartData, liveData);
        chartsGrid?.updateCharts();
    }
    
    async function fetchManualData() {
        try {
            const response = await fetch('/api/current');
            const result = await response.json();
            liveData = result.data;
            lastUpdated = new Date(result.timestamp);
            chartsGrid?.updateCharts();
            console.log('🔄 Manual refresh completed with goal:', result.data?.goal);
        } catch (error) {
            console.error('Failed to fetch manual data:', error);
            handleSimulateData();
        }
    }
    
    onMount(() => {
        let refreshInterval: ReturnType<typeof setInterval>;

        (async () => {
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
                handleSimulateData();
            }

            // Refresh historical data every 5 minutes
            refreshInterval = setInterval(fetchHistoricalData, 5 * 60 * 1000);
        })();

        // Return cleanup function synchronously
        return () => {
            if (refreshInterval) clearInterval(refreshInterval);
        };
    });

    onDestroy(() => {
        if (eventSource) {
            eventSource.close();
        }
    });
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
        <Header {connectionStatus} {lastUpdated} />
        
        <LiveDataSection {liveData} {progressPercentage} {remainingSignatures} />
        
        <StatsGrid {stats} />
        
        <ChartsGrid bind:this={chartsGrid} {chartData} {liveData} {progressPercentage} />
        
        <RecentActivity {historicalData} />
        
        <ControlButtons 
            onManualRefresh={fetchManualData}
            onRefreshAnalytics={fetchHistoricalData}
        />
    </div>
</main>