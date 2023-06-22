<script lang="ts">
    export let colors: string[];
</script>


<svg viewBox="-0.5 -0.5 123 123">
    <path
        d="M 40 81 L 80 81 L 80 1 L 0 1 L 0 81 L 40 81"
        fill="none"
        stroke="{colors[0]}"
        stroke-width="2"
        pointer-events="stroke"
    />
    <path
        d="M 80 121 L 120 121 L 120 41 L 40 41 L 40 121 L 80 121"
        fill="none"
        stroke="{colors[1]}"
        stroke-width="2"
        pointer-events="stroke"
    />
</svg>
