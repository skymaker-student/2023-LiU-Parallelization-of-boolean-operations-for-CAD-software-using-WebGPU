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
import { start } from "$components/lazy/graph";
import { functions } from "$components/lazy/functions";

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

        const options: RandomSquareGridOptions = opts.create;

        let slices = options.count;
        let sliceSize = Math.floor(geometry.length / slices);

        const instances = [] as Geometry[];
        for (let i = 0; i < slices; i++) {
            const start = i * sliceSize;
            const end = start + sliceSize;
            const slice = geometry.slice(start, end);
            instances.push(slice);
        }

        const context = start({
            merge: true,
            removeUnused: false,
            impl: {
                create: null as any,
                union: opts.operations.union,
                intersection: null as any,
                split: opts.operations.split as any,
            },
        });

        const { union, evaluate } = functions(context);

        if (slices == 1) {
            return await evaluate(union(instances[0]));
        }

        let unionGeometry = union(instances[0]);
        for (let i = 1; i < slices; i++) {
            unionGeometry = union(unionGeometry, instances[i]);
        }

        return await evaluate(unionGeometry);
    };

    return {
        create,
        calculate,
    };
};
