<script lang="ts">
    export let onManualRefresh: () => void;
    export let onRefreshAnalytics: () => void;
</script>

<section class="flex flex-col md:flex-row gap-4 justify-center items-center animate-fadeInUp-delay-4">
    <button 
        on:click={onManualRefresh}
        class="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg border border-white/10"
    >
        🔄 Manual Refresh
    </button>
    <button 
        on:click={onRefreshAnalytics}
        class="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg border border-white/10"
    >
        📊 Refresh Analytics
    </button>
</section>