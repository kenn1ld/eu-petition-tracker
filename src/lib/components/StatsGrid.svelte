<script lang="ts">
    import StatCard from './StatCard.svelte';
    
    export let stats: {
        avgPerHour: number;
        peakHour: number;
        totalToday: number;
        timeToGoal: string;
    };
</script>

<section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 animate-fadeInUp-delay-2">
    <StatCard 
        icon="📈" 
        title="Hourly Rate"
        value={stats.avgPerHour}
        subtitle="signatures/hour"
    />
    
    <StatCard 
        icon="🔥" 
        title="Peak Hour"
        value="{stats.peakHour}:00"
        subtitle="most active"
    />
    
    <StatCard 
        icon="📊" 
        title="Today Total"
        value={stats.totalToday}
        subtitle="new signatures"
    />
    
    <StatCard 
        icon="⏰" 
        title="Est. Completion"
        value={stats.timeToGoal}
        subtitle="at current rate"
    />
</section>