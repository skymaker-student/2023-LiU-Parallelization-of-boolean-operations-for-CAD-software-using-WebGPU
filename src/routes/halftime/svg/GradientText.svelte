<script lang="ts">
    export let gradient: string[];
    export let height: number = 3.5;
</script>

<svg style:height="{height}em" viewBox="0 0 300 12.5">
    <defs>
        <linearGradient id="gradient" gradientTransform="rotate(30)">
            {#each gradient as color, i}
                {@const offset = (i * 100) / (gradient.length - 1)}
                <stop stop-color={color} offset="{offset}%" />
            {/each}
        </linearGradient>
    </defs>
    <text fill="url(#gradient)">
        <tspan font-size="10" x="0" y="10"> <slot /></tspan>
    </text>
</svg>

<style>
    text {
        font-weight: 600;
    }
</style>
