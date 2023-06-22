export interface Bounds {
    min: Vec2;
    max: Vec2;
}

export namespace Bounds {
    export function create<T extends Shape>(
        shape: T & { bounds?: Bounds }
    ): T & { bounds: Bounds } {
        if (shape.bounds) return shape as T & { bounds: Bounds };
        const min = { x: Infinity, y: Infinity };
        const max = { x: -Infinity, y: -Infinity };

        for (let node of shape.nodes) {
            min.x = Math.min(min.x, node.x);
            min.y = Math.min(min.y, node.y);
            max.x = Math.max(max.x, node.x);
            max.y = Math.max(max.y, node.y);
        }

        shape.bounds = { min, max };
        return shape as T & { bounds: Bounds };
    }

    export function fromLine(line: Line) {
        return {
            min: {
                x: Math.min(line.start.x, line.end.x),
                y: Math.min(line.start.y, line.end.y),
            },
            max: {
                x: Math.max(line.start.x, line.end.x),
                y: Math.max(line.start.y, line.end.y),
            },
        };
    }

    export function collides(a: Bounds, b: Bounds) {
        if (a.max.x < b.min.x || a.min.x > b.max.x) return false;
        if (a.max.y < b.min.y || a.min.y > b.max.y) return false;

        return true;
    }

    export function join(a: BoundShape, b: BoundShape) {
        return {
            min: {
                x: Math.min(a.bounds!.min.x, b.bounds!.min.x),
                y: Math.min(a.bounds!.min.y, b.bounds!.min.y),
            },
            max: {
                x: Math.max(a.bounds!.max.x, b.bounds!.max.x),
                y: Math.max(a.bounds!.max.y, b.bounds!.max.y),
            },
        };
    }
}
