<script lang="ts">
    import type { EvalMaps, Stage } from "./evaluate";

    export let stages: Stage[] = [];
    export let maps: EvalMaps;

    const grid = 15;
    const seqOffset = 5;

    function getInfo(id: number) {
        return maps.operationInfo.get(id)!;
    }

    function getOp(id: number) {
        return maps.operationMap.get(id)!;
    }

    export let selected = -1;

    function select(id: number) {
        return () => {
            if (selected === id) {
                selected = -1;
            } else {
                selected = id;
            }
        };
    }

    function keyDown(e: KeyboardEvent) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            selected = (selected + 1) % maps.operationMap.size;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            selected = (selected - 1 + maps.operationMap.size) % maps.operationMap.size;
        }
        
    }
</script>

<!----------------------------------------------------------------------------->

<svelte:body on:keydown={keyDown} />

<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<svg viewBox="-5 -5 110 110">
    {#each [...maps.dependants.entries()] as [id, deps]}
        {@const seq = getInfo(id).sequential}
        {@const a = getInfo(id).place}
        {#each deps as dep}
            {@const b = getInfo(dep).place}
            {@const seqb = getInfo(dep).sequential}

            <line
                x1={a.x * grid}
                y1={a.y * grid + (seq ? 0 : seqOffset)}
                x2={b.x * grid}
                y2={b.y * grid + (seqb ? 0 : seqOffset)}
                stroke="white"
                stroke-width={seq || seqb ? 0.5 : 1}
            />
        {/each}
    {/each}

    {#each stages as stage, row}
        {#each stage as id, col}
            {@const op = getOp(id)}
            {@const info = getInfo(id)}
            {@const x = col * grid}
            {@const y = row * grid + (info.sequential ? 0 : seqOffset)}
            {@const sel = id === selected}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <g on:click={select(id)}>
                {#if info.sequential}
                    <!-- square -->
                    <rect
                        x={x - 2.5}
                        y={y - 2.5}
                        width="5"
                        height="5"
                        data-type={op.op}
                        class:selected={sel}
                    />
                {:else}
                    <!-- circle -->
                    <circle
                        cx={x}
                        cy={y}
                        r="2.5"
                        data-type={op.op}
                        class:merge={info.merge}
                        class:selected={sel}
                    />
                {/if}
                <text {x} {y}>{op.ret.id}</text>
            </g>
        {/each}
    {/each}
</svg>

<!----------------------------------------------------------------------------->
<style>
    svg {
        position: absolute;
        width: 100%;
        height: 100%;
        inset: 0;
        z-index: 10;
        pointer-events: none;
    }

    text {
        font-size: 2.5pt;
        fill: white;
        text-anchor: middle;
        dominant-baseline: middle;
        pointer-events: none;
        user-select: none;
    }

    g {
        pointer-events: painted;
    }

    [data-type="create"] {
        fill: violet;
    }

    [data-type="intersection"] {
        fill: yellowgreen;
    }

    [data-type="union"] {
        fill: cornflowerblue;
    }

    [data-type="split"] {
        fill: sienna;
    }

    .merge {
        stroke: tomato;
        stroke-width: 0.75pt;
    }

    .selected {
        stroke: white;
        stroke-width: 0.75pt;
    }
</style>
