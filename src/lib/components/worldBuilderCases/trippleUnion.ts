import { CAD as CPU } from "$skymaker";
import {
    randomSquareGrid,
    mergeGeometry,
    type RandomSquareGridOptions,
    square,
} from "$skymaker/geometry";
import type { CalculateFunction, CreateFunction } from "$components/worldBuilder";
import { debugNumber } from "$debug/visual";
import { get } from "svelte/store";
import { brokenCPU } from "$debug/geometry";

export const create: CreateFunction = async (options) => {
    if (options.create.mode !== "random") throw new Error("Invalid create mode");
    return randomSquareGrid(options.create);
};

export const calculate: CalculateFunction = async (geometry, opts) => {
    if (opts.create.mode !== "random") throw new Error("Invalid create mode");

    const { union, split } = opts.impl;

    const options: RandomSquareGridOptions = opts.create;

    let slices = 4;
    let sliceSize = Math.floor(geometry.length / slices);
    // geometry = brokenCPU();

    const instances = [] as Geometry[];
    for (let i = 0; i < slices; i++) {
        const start = i * sliceSize;
        const end = start + sliceSize;
        const slice = geometry.slice(start, end);
        instances.push(slice);
    }

    // Pass 1
    const mergedInstances1 = mergeGeometry([instances[0], instances[1]]);
    const union1 = await union(mergedInstances1);
    if (get(debugNumber) === 1) return mergedInstances1;
    if (get(debugNumber) === 2) return union1;

    // Pass 2
    const mergedInstances2 = mergeGeometry([union1, instances[2]]);
    const union2 = await union(mergedInstances2);
    if (get(debugNumber) === 3) return mergedInstances2;
    if (get(debugNumber) === 4) return union2;

    // Pass 3
    const mergedInstances3 = mergeGeometry([union2, instances[3]]);
    const union3 = await union(mergedInstances3);
    if (get(debugNumber) === 5) return mergedInstances3;
    if (get(debugNumber) === 6) return union3;

    return union3;
};
