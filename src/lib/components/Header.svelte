<script lang="ts">
    export let connectionStatus: string;
    export let lastUpdated: Date | null;
</script>

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