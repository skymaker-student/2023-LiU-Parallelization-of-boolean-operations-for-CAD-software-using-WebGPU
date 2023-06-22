/// <reference types="svelte" />
/// <reference types="vite/client" />

declare module "*?array" {
    const value: any[];
    export default value;
}

declare module "*?array!svelte" {
    const value: SvelteComponent[];
    export default value;
}

declare module "*?array!json" {
    const value: any[];
    export default value;
}
