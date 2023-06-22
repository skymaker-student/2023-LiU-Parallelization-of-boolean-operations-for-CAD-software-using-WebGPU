import type { Execute } from ".";
import { bounds, type GraphContext, type Input } from "../graph";

function intersection(context: GraphContext, ...geometry: Input<Geometry>[]) {
    const { ref, value, queue, fromInputGeometry } = context;

    const args = geometry.map(fromInputGeometry);

    return queue({
        op: "intersection",
        args: args,
        ret: ref(bounds(args)),
    });
}

const execute = {
    name: "intersection",
    sequential: false,
    execute: async (context, ...geometry) => {
        return await context.impl.intersection(geometry.flat());
    },
} satisfies Execute<typeof intersection>;

export default {
    lazy: intersection,
    execute: execute,
};
