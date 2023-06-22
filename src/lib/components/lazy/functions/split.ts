import type { Execute } from ".";
import { bounds, type GraphContext, type Input } from "../graph";

function split(context: GraphContext, ...geometry: Input<Geometry>[]) {
    const { ref, value, fromInput, fromInputGeometry, queue } = context;
    console.log("split");

    const args = geometry.map(fromInputGeometry);
    return queue({
        op: "split",
        args: args,
        ret: ref(bounds(args)),
    });
}

const execute = {
    name: "split",
    sequential: false,
    execute: async (context, ...geometry) => {
        return await context.impl.union(geometry.flat());
    },
} satisfies Execute<typeof split>;

export default {
    lazy: split,
    execute: execute,
};
