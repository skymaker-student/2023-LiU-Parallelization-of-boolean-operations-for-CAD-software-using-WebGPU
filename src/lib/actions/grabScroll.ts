type GrabScrollOptions = {
    velocityCoefficient?: number;
};

const defaultOptions: GrabScrollOptions = {
    velocityCoefficient: 0.9,
};

export function grabScroll(node: HTMLElement, options: GrabScrollOptions = {}) {
    let velocityScrolling = false;

    let opts = Object.assign({}, defaultOptions, options ?? {}) as Required<GrabScrollOptions>;

    let client = { x: 0, y: 0 };
    let scroll = { x: 0, y: 0 };

    function prevent(e: Event) {
        e.preventDefault();
        e.stopPropagation();
    }

    let moved = false;
    node.addEventListener("pointerdown", (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;

        client = { x: e.clientX, y: e.clientY };
        scroll = { x: node.scrollLeft, y: node.scrollTop };
        velocityScrolling = false;
        moved = false;

        node.setPointerCapture(e.pointerId);

        node.addEventListener("pointermove", handleMouseMove);
        node.addEventListener("pointerup", handleMouseUp);
        node.addEventListener("pointercancel", handleMouseUp);
    });

    function handleMouseMove(e: PointerEvent) {
        const { clientX: x, clientY: y } = e;
        let dx = client.x - x;
        let dy = client.y - y;

        let targetX = scroll.x + dx;
        let targetY = scroll.y + dy;
        if (targetX < 0) targetX = 0;
        if (targetY < 0) targetY = 0;

        if (targetX > node.scrollWidth - node.clientWidth)
            targetX = node.scrollWidth - node.clientWidth;
        if (targetY > node.scrollHeight - node.clientHeight)
            targetY = node.scrollHeight - node.clientHeight;

        if (dx !== 0 || dy !== 0) {
            moved = true;
            node.addEventListener("click", prevent, { capture: true, once: true });
        }

        node.scrollTo(targetX, targetY);

        getVelocity(e);
    }

    function handleMouseUp(e: PointerEvent) {
        e.preventDefault();
        node.removeEventListener("pointermove", handleMouseMove);
        node.removeEventListener("pointerup", handleMouseUp);
        node.removeEventListener("pointercancel", handleMouseUp);

        if (opts.velocityCoefficient <= 0) return;
        let vel = getVelocity();

        if (vel.x === 0 && vel.y === 0) return;

        function velocityScroll() {
            if (!velocityScrolling) return;

            let targetX = node.scrollLeft - vel.x;
            let targetY = node.scrollTop - vel.y;
            if (targetX < 0) targetX = 0;
            if (targetY < 0) targetY = 0;

            if (targetX > node.scrollWidth - node.clientWidth)
                targetX = node.scrollWidth - node.clientWidth;
            if (targetY > node.scrollHeight - node.clientHeight)
                targetY = node.scrollHeight - node.clientHeight;

            node.scrollTo(targetX, targetY);

            vel.x *= opts.velocityCoefficient;
            vel.y *= opts.velocityCoefficient;

            if (Math.abs(vel.x) < 0.1 && Math.abs(vel.y) < 0.1) {
                velocityScrolling = false;
                return;
            }

            requestAnimationFrame(velocityScroll);
        }
        velocityScrolling = true;
        requestAnimationFrame(velocityScroll);
    }

    

    return {
        update(options: GrabScrollOptions) {
            opts = Object.assign({}, defaultOptions, options ?? {}) as Required<GrabScrollOptions>;
        },
        destroy() {},
    };
}

const resetDelay = 50;

let velocity: Vec2 | null = null;

let last = { x: 0, y: 0 };
let timer: any = null;

let lastEvent: MouseEvent;
export function getVelocity(e: MouseEvent | undefined = undefined) {
    if (!e) return velocity ?? { x: 0, y: 0 };
    if (lastEvent === e) {
        return velocity ?? { x: 0, y: 0 };
    }
    lastEvent = e;

    if (velocity === null) {
        last.x = e.screenX;
        last.y = e.screenY;
        velocity = { x: 0, y: 0 };
    } else {
        velocity.x = e.screenX - last.x;
        velocity.y = e.screenY - last.y;

        last.x = e.screenX;
        last.y = e.screenY;

        clearTimeout(timer);
        timer = setTimeout(() => {
            velocity = null;
        }, resetDelay);
    }

    return velocity;
}
