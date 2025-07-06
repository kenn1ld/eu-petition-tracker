<script lang="ts">
    export let icon: string;
    export let title: string;
    export let value: string | number;
    export let subtitle: string;
</script>

<div class="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform duration-300 group">
    <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
    <h3 class="text-sm text-slate-400 mb-4 font-medium">{icon} {title}</h3>
    <p class="text-3xl font-bold gradient-text mb-1">{value}</p>
    <span class="text-slate-400 text-sm">{subtitle}</span>
</div>
