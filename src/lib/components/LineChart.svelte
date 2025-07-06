<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    
    export let chartData: any[] = [];
    
    let Chart: any;
    let lineChart: any;
    let lineChartCanvas: HTMLCanvasElement;
    
    async function loadChart() {
        if (browser) {
            const chartModule = await import('chart.js/auto');
            Chart = chartModule.default;
        }
    }
    
    export function updateChart() {
        if (!Chart || !chartData.length || !lineChartCanvas) return;
        
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
    
    onMount(async () => {
        await loadChart();
        updateChart();
    });
    
    onDestroy(() => {
        if (lineChart) {
            lineChart.destroy();
        }
    });
    
    $: if (Chart && chartData.length) {
        updateChart();
    }
</script>

<div class="lg:col-span-2 glass rounded-2xl p-6 animate-fadeInUp-delay-3">
    <h3 class="text-xl font-semibold text-white mb-6">📈 Signatures by Hour (Last 24h)</h3>
    <div class="relative h-80">
        <canvas bind:this={lineChartCanvas}></canvas>
    </div>
</div>