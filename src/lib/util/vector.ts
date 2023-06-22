import { Compare } from "./comparison";

export namespace Vec2 {
    export function zero(): Vec2 {
        return { x: 0, y: 0 };
    }

    export function one(): Vec2 {
        return { x: 1, y: 1 };
    }

    //

    export function add(a: Vec2, b: Vec2): Vec2 {
        return { x: a.x + b.x, y: a.y + b.y };
    }
    export function sub(a: Vec2, b: Vec2): Vec2 {
        return { x: a.x - b.x, y: a.y - b.y };
    }

    export function scale(a: Vec2, s: number): Vec2 {
        return { x: a.x * s, y: a.y * s };
    }

    export function dot(a: Vec2, b: Vec2): number {
        return a.x * b.x + a.y * b.y;
    }

    export function cross(a: Vec2, b: Vec2): number {
        return a.x * b.y - a.y * b.x;
    }

    export function length(a: Vec2): number {
        return Math.sqrt(a.x * a.x + a.y * a.y);
    }

    export function normalize(a: Vec2): Vec2 {
        const len = length(a);
        return { x: a.x / len, y: a.y / len };
    }

    export function isEqual(a: Vec2, b: Vec2): boolean {
        return Compare.equal(a.x, b.x) && Compare.equal(a.y, b.y);
    }
}

export {};
