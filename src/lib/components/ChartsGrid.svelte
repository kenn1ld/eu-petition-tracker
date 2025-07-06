<script lang="ts">
    import LineChart from './LineChart.svelte';
    import DoughnutChart from './DoughnutChart.svelte';
    
    export let chartData: any[];
    export let liveData: any;
    export let progressPercentage: number;
    
    let lineChart: LineChart;
    let doughnutChart: DoughnutChart;
    
    export function updateCharts() {
        lineChart?.updateChart();
        doughnutChart?.updateChart();
    }
</script>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
    <LineChart bind:this={lineChart} {chartData} />
    <DoughnutChart bind:this={doughnutChart} {liveData} {progressPercentage} />
</div>