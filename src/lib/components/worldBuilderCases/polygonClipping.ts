import type { CalculateFunction, CreateFunction } from "$components/worldBuilder";
import { randomSquareGrid } from "$skymaker/geometry";

import polygonClipping, { type Pair, type Polygon } from "polygon-clipping";

export const create: CreateFunction = async (options) => {
    if (options.create.mode !== "random") throw new Error("Invalid create mode");
    return randomSquareGrid(options.create);
};

export const calculate = async (geometry: Geometry) => {
    const tmpGeometry = geometry.map((g) => [g.nodes.map((p) => [p.x, p.y] as Pair)] as Polygon);

    const result = polygonClipping.union(tmpGeometry);

    const r = result.flatMap((p) => {
        return {
            nodes: p[0].map((n) => ({ x: n[0], y: n[1] })),
            holes: p.slice(1).map((h) => h.map((n) => ({ x: n[0], y: n[1] }))),
        };
    });

    return r;
};
