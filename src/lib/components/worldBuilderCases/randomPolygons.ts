import type { CalculateFunction, CreateFunction } from "$components/worldBuilder";
import { randomSquareGrid, randomPolygonGrid } from "$skymaker/geometry";

export const create: CreateFunction = async (options) => {
    if (options.create.mode !== "random") throw new Error("Invalid create mode");
    return randomPolygonGrid({
        count: options.create.count,
        maxVertices: 4,
        maximize: true,
        seed: options.create.seed,
        density: options.create.density,
    });
};

export const calculate: CalculateFunction = async (geometry, opts) => {
    return opts.impl.union(geometry);
};
