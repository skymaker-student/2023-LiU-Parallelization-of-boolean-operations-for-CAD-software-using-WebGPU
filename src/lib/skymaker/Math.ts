import { Compare } from "$util/comparison";
import { Vec2 } from "$util/vector";


export const DECIMALS_FOR_CHECK = 6;
export function getVectorAngle2D(v1: Vec2, v2: Vec2) {
    const d = Math.abs(Vec2.length(v1)) * Math.abs(Vec2.length(v2)); // TODO: Ask Kristofer why Math.abs?
    const t = Vec2.dot(v1, v2); // Dot product

    if (!Compare.equal(d, 0)) {
        // * Using clamp to ensure value is between -1 and 1. Math.acos below requires it.
        const q = clamp(t / d, -1, 1);

        const angle = Math.acos(q);

        const z = Vec2.cross(v1, v2); // Cross product: calculate signed area of spanning quad.
        const sign = z >= 0 ? 1 : -1;
        return angle * sign;
    } else {
        return 0;
    }
}

// TODO: this does not seem efficient? Is it for safety?
export function projectPositionOnLine(
    position: Vec2,
    lineStartPosition: Vec2,
    lineEndPosition: Vec2
) {
    const tolerance = 0.000001;
    if (Vec2.length(Vec2.sub(lineStartPosition, lineEndPosition)) < tolerance) {
        throw new Error(
            `${JSON.stringify(lineStartPosition)}, and ${JSON.stringify(
                lineEndPosition
            )} is same position, not possible to create lines from two points!`
        );
    }
    const line = Vec2.sub(lineEndPosition, lineStartPosition);
    const checkVector = Vec2.sub(position, lineStartPosition);

    const angle = getVectorAngle2D(checkVector, line);
    if (!isFinite(angle)) {
        throw new Error(
            `Angle could net be created for ${JSON.stringify(checkVector)}, ${JSON.stringify(line)}`
        );
    }
    const activeLength = Vec2.length(checkVector);

    const dist = activeLength * Math.cos(angle);
    const offset = activeLength * Math.sin(angle);
    const scaleDist = dist / Vec2.length(line);
    const scaleOffset = offset / Vec2.length(line);

    return {
        d: scaleOffset,
        s: scaleDist,
    };
}

/**
 * Returns the clamped value between min and max
 */
export function clamp(value: number, min: number, max: number) {
    // FIX: Move to own file "Basic Math functions"?
    return Math.min(Math.max(value, min), max);
}

/**
 * Precision check if a === b
 * @param a
 * @param b
 * @param decimals
 */
export function isEqual(a: number, b: number, decimals: number = DECIMALS_FOR_CHECK) {
    if (decimals === undefined) {
        console.warn("Number of decimals must be specified. Otherwise use ===");
        return a === b;
    }

    if (a === b) {
        return true;
    } else {
        const p = Math.pow(10, decimals);
        const aScaled = a * p; // ToDo: Handle special case a = 1.005 and decimals = 2 => 100.4999. See test cases prepared for this
        const bScaled = b * p;

        let anchorValue;
        anchorValue = Math.round(aScaled);
        const diffA = aScaled - anchorValue;
        const diffB = bScaled - anchorValue;

        const aOnRoundingInterval = -0.5 <= diffA && diffA < 0.5;
        const bOnAnchorInterval = -0.5 <= diffB && diffB < 0.5;

        return aOnRoundingInterval && bOnAnchorInterval;
    }
}

export function isZero(a: number, decimals: number = DECIMALS_FOR_CHECK) {
    return isEqual(a, 0, decimals);
}

/**
 * Precision check if a < b
 * @param a
 * @param b
 * @param decimals
 */
export function isLess(a: number, b: number, decimals: number = DECIMALS_FOR_CHECK) {
    if (decimals === undefined) {
        console.warn("Number of decimals must be specified. Otherwise use a < b");
        return a < b;
    }

    const p = Math.pow(10, decimals);
    const aScaled = a * p;
    const bScaled = b * p;

    let anchorValue;
    anchorValue = Math.round(bScaled);
    const diffA = aScaled - anchorValue;
    const diffB = bScaled - anchorValue;

    const aOnLowerInterval = diffA < -0.5;
    const bOnAnchorInterval = -0.5 <= diffB && diffB < 0.5;

    return aOnLowerInterval && bOnAnchorInterval;
}

/**
 * Precision check if a > b
 * @param a
 * @param b
 * @param decimals
 */
export function isGreater(a: number, b: number, decimals: number = DECIMALS_FOR_CHECK) {
    if (decimals === undefined) {
        console.warn("Number of decimals must be specified. Otherwise use a > b");
        return a > b;
    }

    const p = Math.pow(10, decimals);
    const aScaled = a * p;
    const bScaled = b * p;

    let anchorValue;
    anchorValue = Math.round(bScaled);
    const diffA = aScaled - anchorValue;
    const diffB = bScaled - anchorValue;

    const aOnNextInterval = 0.5 <= diffA;
    const bOnRoundingInterval = -0.5 <= diffB && diffB < 0.5;

    return aOnNextInterval && bOnRoundingInterval;
}

/**
 * Precision check if a <= b
 * @param a
 * @param b
 * @param decimals
 */
export function isLessOrEqual(a: number, b: number, decimals: number = DECIMALS_FOR_CHECK) {
    return isLess(a, b, decimals) || isEqual(a, b, decimals);
}

/**
 * Precision check if a >= b
 * @param a
 * @param b
 * @param decimals
 */
export function isGreaterOrEqual(a: number, b: number, decimals: number = DECIMALS_FOR_CHECK) {
    return isGreater(a, b, decimals) || isEqual(a, b, decimals);
}

export class Bounds2D {
    min: Vec2;
    max: Vec2;
    constructor(minPos: Vec2, maxPos: Vec2) {
        this.max = maxPos;
        this.min = minPos;
    }

    getCenter() {
        return Vec2.scale(Vec2.add(this.max, this.min), 0.5);
    }

    checkPosInside(pos: Vec2) {
        const xOk = this.min.x < pos.x && pos.x < this.max.x;
        const yOk = this.min.y < pos.y && pos.y < this.max.y;
        return xOk && yOk;
    }

    isOverlappingBounds(bounds: Bounds2D) {
        const check =
            isGreater(this.max.x, bounds.min.x, DECIMALS_FOR_CHECK) &&
            isLess(this.min.x, bounds.max.x, DECIMALS_FOR_CHECK) &&
            isGreater(this.max.y, bounds.min.y, DECIMALS_FOR_CHECK) &&
            isLess(this.min.y, bounds.max.y, DECIMALS_FOR_CHECK);
        return check;
    }

    getSize() {
        return { x: Math.abs(this.min.x - this.max.x), y: Math.abs(this.min.y - this.max.y) };
    }
}

/**
 * Creates a pseudo-random value generator. The seed must be an integer.
 *
 * Uses an optimized version of the Park-Miller PRNG.
 * http://www.firstpr.com.au/dsp/rand31/
 * Fork of https://gist.github.com/blixt/f17b47c62508be59987b
 */
export class PseudoRandomizer {
    private seed: number;

    constructor(args?: { seed?: number }) {
        args = args || {};
        const seed = args.seed !== undefined ? args.seed : 115107121; // SKY - Use as tracker
        this.seed = Math.round(seed) % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }

    getSeed() {
        return this.seed;
    }

    /**
     * Returns a pseudo-random value between 1 and 2^32 - 2.
     */
    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return this.seed;
    }

    /**
     * Returns a pseudo-random floating point number in range [0, 1).
     */
    nextFloat() {
        // We know that result of next() will be 1 to 2147483646 (inclusive).
        return (this.next() - 1) / 2147483646;
    }

    nextFloatExclusive() {
        // We know that result of next() will be 1 to 2147483646 (inclusive).
        return (this.next() - 1) / 2147483647;
    }
}
