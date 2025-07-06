<script lang="ts">
    export let liveData: any;
    export let progressPercentage: number;
    export let remainingSignatures: number;
</script>

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
