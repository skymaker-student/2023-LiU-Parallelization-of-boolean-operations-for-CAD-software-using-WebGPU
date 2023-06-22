export function onEnter(node: HTMLElement, callback: Function) {
    function keyup(event: KeyboardEvent) {
        if (event.key === "Enter") {
            callback(event);
        }
    }
    node.addEventListener("keyup", keyup);

    return {
        update(newCallback: Function) {
            callback = newCallback;
        },
        destroy() {
            node.removeEventListener("keyup", keyup);
        },
    };
}