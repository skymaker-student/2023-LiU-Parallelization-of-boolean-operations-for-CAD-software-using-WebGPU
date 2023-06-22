<script lang="ts">
    import type { Benchmark } from "routes/halftime/Benchmarks.svelte";
    import { createData, type GraphContext } from "./graph";

    export let benchmark: Benchmark;
    export let context: GraphContext;
    export let color: string;

    export let intervals: { min: number; max: number; fill: number }[];

    const { mapX, mapY } = context;
    const data = createData(benchmark);

    function createPoints() {
        return data.map((result) => `${mapX(result.x)},${mapY(result.median)}`).join(" ");
    }

    function createPolygon(p1: number, p2: number) {
        const top = data
            .map((result) => `${mapX(result.x)},${mapY(result.percentile(p1))}`)
            .join(" ");

        const bot = [...data]
            .reverse()
            .map((result) => `${mapX(result.x)},${mapY(result.percentile(p2))}`)
            .join(" ");

        return `${top} ${bot}`;
    }
</script>

{#each intervals as interval}
    <polygon
        points={createPolygon(interval.min, interval.max)}
        {color}
        fill-opacity={interval.fill}
    />
{/each}

<polyline points={createPoints()} {color} fill="none" stroke-width="0.025em" />
{#each data as result (result.x)}
    {@const x = mapX(result.x)}
    {@const y = mapY(result.median)}

    <circle cx={x} cy={y} r="0.025em" {color} />
{/each}

<!----------------------------------------------------------------------------->
<style>
    polyline {
        stroke: currentColor;
        stroke-linejoin: round;
        stroke-linecap: round;
    }

    circle {
        fill: currentColor;
    }

    polygon {
        fill: currentColor;
    }
</style>
