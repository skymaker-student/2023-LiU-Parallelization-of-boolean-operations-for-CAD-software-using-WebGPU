import type { Execute } from ".";
import type { GraphContext, Input } from "../graph";

function create({ ref, value, queue, fromInputGeometry }: GraphContext, ...geometry: Input<Geometry>[]) {
    const args = geometry.map(fromInputGeometry);

    const bounds = {
        min: {x: 0, y: 0}  as Vec2,
        max: {x: 0, y: 0}  as Vec2,
    };

    return queue({
        op: "join",
        args: args,
        ret: ref(bounds),
    });
}

const execute = {
    name: "create",
    sequential: true,
    execute: async (context, ...geometry) => {
        return geometry.flat();
    }
} satisfies Execute<typeof create>;

export default {
    lazy: create,
    execute: execute,
};
