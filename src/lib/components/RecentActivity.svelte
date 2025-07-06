<script lang="ts">
    import ActivityItem from './ActivityItem.svelte';
    
    export let historicalData: any[];
</script>

{#if historicalData.length > 0}
    <section class="glass rounded-2xl p-6 mb-12 animate-fadeInUp-delay-4">
        <h3 class="text-xl font-semibold text-white mb-6">🕐 Recent Activity</h3>
        <div class="space-y-3 max-h-96 overflow-y-auto pr-2">
            {#each historicalData.slice(-10).reverse() as entry}
                <ActivityItem {entry} />
            {/each}
        </div>
    </section>
{/if}