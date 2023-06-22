<script lang="ts">
    import components from "components?array!svelte";
    import HalftimePoster from "routes/halftime/Page.svelte";
    import type { SvelteComponent } from "svelte";
    import { writableLocalStorage } from "./lib/util/localStorageStore";

    let index = writableLocalStorage("selected-component-index", 2);

    $: $index = Math.min($index, components.length - 1);

    function name(component: SvelteComponent) {
        return component.name.slice(6, -1);
    }

    let showNav = true;

    (window as any).toggleNav = () => {
        showNav = !showNav;
    };

    let route = window.location.pathname.slice(1);
</script>

<!----------------------------------------------------------------------------->

{#if route === "halftime"}
    <HalftimePoster />
{:else}
    <main class:hideNav={!showNav}>
        <nav>
            <select bind:value={$index}>
                {#each components as component, i}
                    <option value={i}>{name(component)}</option>
                {/each}
            </select>
        </nav>
        <div class="component">
            {#key $index}
                <svelte:component this={components[$index]} />
            {/key}
        </div>
    </main>
{/if}

<!----------------------------------------------------------------------------->
<style>
    main {
        display: grid;
        grid-template:
            "nav" max-content
            "content" 1fr
            / 1fr;
        gap: 1rem;

        max-height: 100vh;
        height: 100vh;
        overflow: hidden;
    }

    .hideNav {
        grid-template:
            "content" 1fr
            / 1fr;
    }

    nav {
        grid-area: nav;
    }

    .hideNav nav {
        display: none;
    }

    select {
        width: 100%;
        height: 100%;
        font-size: 1.25rem;
        padding: 0.5rem;
    }
    .component {
        height: 100%;
        overflow: hidden;
    }
</style>
