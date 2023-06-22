<script lang="ts">
    import { onMount } from "svelte";

    export let colors: string[];

    let path: SVGPathElement;
    let pathLength = 0;

    onMount(() => {
        all();
    });

    function sleep(ms: number) {
        return new Promise<void>((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    let d = 5;
    let dash = false;
    let drawPath = false;

    function define() {}

    function split() {
        return new Promise<void>((resolve) => {
            const interval = setInterval(() => {
                d -= 0.5;
                if (d <= 0) {
                    clearInterval(interval);
                    resolve();
                }
            }, 10);
        });
    }

    async function filter() {
        dash = true;
        await sleep(250);
    }

    const skip = [
        false,
        false,
        false,
        true,
        false,
        true,
        false,
        false,
        false,
        true,
        false,
        true,
        false,
    ];
    async function build() {
        if (!path) return;

        let total = path.getTotalLength();
        path.style.setProperty("--length", `${total}`);
        path.style.setProperty("--start", `${total}`);
        drawPath = true;

        for (let i = 0; i <= 12; i++) {
            await sleep(250);
            if (skip[i]) i += 1;
            path.style.setProperty("--start", `${total * ((12 - i) / 12)}`);
        }
    }

    type State = {
        enter?: () => Promise<void> | void;
        exit?: () => Promise<void> | void;
        next: string;
    };

    let states = {
        start: {
            enter: () => {
                d = 5;
                dash = false;
                drawPath = false;
            },
            next: "split",
        },
        define: {
            enter: define,
            next: "split",
        },
        split: {
            enter: split,
            next: "filter",
        },
        filter: {
            enter: filter,
            next: "build",
        },
        build: {
            enter: build,
            exit: () => {
                let total = path.getTotalLength();
                path.style.setProperty("--length", `${total}`);
                path.style.setProperty("--start", `0`);
            },
            next: "start",
        },
    } as Record<string, State>;
    let state = "start";

    async function all() {
        while (true) {
            state = states[state].next;
            await states[state].enter?.();
            await sleep(1000);
            await states[state].exit?.();
        }
    }
</script>

<svelte:body on:click={all} />
<svg
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    version="1.1"
    width="200px"
    viewBox="-1 -1 125 125"
>
    <g id="shape1" class:drawing={drawPath} style:--color={colors[0]}>
        <path
            d="M 1 {6 - d} L 1 {76 + d}"
            fill="none"
            stroke={colors[0]}
            stroke-width="2"
            stroke-linecap="square"
        />
        <path
            d="M {6 - d} 1 L {76 + d} 1"
            fill="none"
            stroke={colors[0]}
            stroke-width="2"
            stroke-linecap="square"
        />
        <path
            d="M 81 {6 - d} L 81 {36 + d}"
            fill="none"
            stroke={colors[0]}
            stroke-width="2"
            stroke-linecap="square"
        />
        <path
            class:dash
            d="M 81 {46 - d} L 81 {76 + d}"
            fill="none"
            stroke={colors[0]}
            stroke-width="2"
            stroke-linecap="square"
            stroke-dashoffset="-2"
        />
        <path
            class:dash
            d="M {46 - d} 81 L {76 + d} 81"
            fill="none"
            stroke={colors[0]}
            stroke-width="2"
            stroke-linecap="square"
            stroke-dashoffset="-2"
        />
        <path
            d="M {6 - d} 81 L {36 + d} 81"
            fill="none"
            stroke={colors[0]}
            stroke-width="2"
            stroke-linecap="square"
        />
    </g>
    <g id="shape2" class:drawing={drawPath} style:--color={colors[1]}>
        <path
            d="M {46 - d} 121 L {116 + d} 121"
            fill="none"
            stroke={colors[1]}
            stroke-width="2"
            stroke-linecap="square"
        />
        <path
            d="M 121 {46 - d} L 121 {116 + d}"
            fill="none"
            stroke={colors[1]}
            stroke-width="2"
            stroke-linecap="square"
        />
        <path
            d="M 41 {86 - d} L 41 {116 + d}"
            fill="none"
            stroke={colors[1]}
            stroke-width="2"
            stroke-linecap="square"
        />
        <path
            class:dash
            d="M 41 {46 - d} L 41 {76 + d}"
            fill="none"
            stroke={colors[1]}
            stroke-width="2"
            stroke-linecap="square"
        />
        <path
            class:dash
            d="M {46 - d} 41 L {76 + d} 41"
            fill="none"
            stroke={colors[1]}
            stroke-width="2"
            stroke-linecap="square"
        />
        <path
            d="M {86 - d} 41 L {116 + d} 41"
            fill="none"
            stroke={colors[1]}
            stroke-width="2"
            stroke-linecap="square"
        />
    </g>

    <g id="final" style:--color={colors[0]}>
        <!-- <path
            class:path={drawPath}
            bind:this={path}
            style:--length={pathLength}
            d="M 81.4 1 L 81.4 40.6 L 121 40.6 L 121 121 L 40.6 121 L 40.6 81.4 L 1 81.4 L 1 1 Z"
            fill="none"
            stroke={colors[0]}
            stroke-width="2"
            stroke-miterlimit="10"
            stroke-linecap="square"
        /> -->

        <path
            class:path={drawPath}
            bind:this={path}
            style:--length={pathLength}
            d="M 1 81 L 41 81 L 41 121 L 81 121 L 121 121 L 121 81 L 121 41 L 81 41 L 81 1 L 41 1 L 1 1 L 1 41 L 1 81"
            fill="none"
        />
        <g />
    </g></svg
>

<style>
    path,
    path {
        stroke: var(--color);
        stroke-width: 2;
        stroke-linecap: square;
        transition: stroke-width 250ms, stroke 250ms;
    }

    .drawing path {
        stroke-width: 1;
    }

    .dash {
        stroke-dasharray: 2 4;
        stroke: #ccc;
        animation: 500ms ease-out dash;
    }

    @keyframes dash {
        0% {
            stroke-dasharray: 6 0;
            stroke: var(--color);
        }
        100% {
            stroke-dasharray: 2 4;
            stroke: #ccc;
        }
    }

    .path {
        stroke-dasharray: var(--length);
        stroke-dashoffset: var(--start);
        transition: stroke-dashoffset 100ms;
    }
</style>
