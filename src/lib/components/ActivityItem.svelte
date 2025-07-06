<script lang="ts">
    export let entry: {
        timestamp: string;
        change_amount: number;
        signature_count: number;
    };
</script>

<div class="glass rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 items-center hover:bg-white/10 transition-colors">
    <span class="text-sm text-slate-400 font-mono">
        {new Date(entry.timestamp).toLocaleTimeString()}
    </span>
    <span class="font-semibold text-green-400">
        +{entry.change_amount} signatures
    </span>
    <span class="text-sm text-slate-300 text-right">
        Total: {entry.signature_count.toLocaleString()}
    </span>
</div>