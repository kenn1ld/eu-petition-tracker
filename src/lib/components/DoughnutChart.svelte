<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    
    export let liveData: any;
    export let progressPercentage: number;
    
    let Chart: any;
    let doughnutChart: any;
    let doughnutChartCanvas: HTMLCanvasElement;
    
    async function loadChart() {
        if (browser) {
            const chartModule = await import('chart.js/auto');
            Chart = chartModule.default;
        }
    }
    
    export function updateChart() {
        if (!Chart || !liveData || !doughnutChartCanvas) return;
        
        if (doughnutChart) {
            doughnutChart.destroy();
        }
        
        const ctx = doughnutChartCanvas.getContext('2d');
        if (!ctx) return;
        
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
    
    onMount(async () => {
        await loadChart();
        updateChart();
    });
    
    onDestroy(() => {
        if (doughnutChart) {
            doughnutChart.destroy();
        }
    });
    
    $: if (Chart && liveData) {
        updateChart();
    }
</script>

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