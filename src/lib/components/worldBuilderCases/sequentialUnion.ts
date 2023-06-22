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

export default (lineCount: number = 2000) => {
    const create: CreateFunction = async (options) => {
        if (options.create.mode !== "random") throw new Error("Invalid create mode");
        return randomSquareGrid({
            mode: "random",
            count: lineCount,
            density: options.create.density,
            seed: options.create.seed,
        } as RandomSquareGridOptions);
    };

    const calculate: CalculateFunction = async (geometry, opts) => {
        if (opts.create.mode !== "random") throw new Error("Invalid create mode");

        const { union } = opts.impl;

        const options: RandomSquareGridOptions = opts.create;

        let slices = options.count;
        let sliceSize = Math.floor(geometry.length / slices);
        // geometry = brokenCPU();

        const instances = [] as Geometry[];
        for (let i = 0; i < slices; i++) {
            const start = i * sliceSize;
            const end = start + sliceSize;
            const slice = geometry.slice(start, end);
            instances.push(slice);
        }

        if (slices == 1) {
            return await union(instances[0]);
        }

        // Pass 1
        let mergedInstances = mergeGeometry([instances[0]]);
        let unionGeometry = await union(mergedInstances);
        if (get(debugNumber) === 1) return mergedInstances;
        if (get(debugNumber) === 2) return unionGeometry;

        for (let i = 1; i < slices; i++) {
            mergedInstances = mergeGeometry([unionGeometry, instances[i]]);
            unionGeometry = await union(mergedInstances);
            if (get(debugNumber) === 2 * i + 1) return mergedInstances;
            if (get(debugNumber) === 2 * i + 2) return unionGeometry;
        }

        return unionGeometry;
    };

    return {
        create,
        calculate,
    }
};
