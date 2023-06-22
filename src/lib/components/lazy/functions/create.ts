import type { Execute } from ".";
import type { GraphContext, Input } from "../graph";

function create({ ref, value, queue, fromInput }: GraphContext, ...position: Input<Vec2[]>[]) {
    const radius = 1;

    const args = position.map(fromInput);

    // const bounds = position.reduce(
    //     (bounds, pos) => {
    //         const [x, y] = pos;
    //         return {
    //             min: [
    //                 Math.min(bounds.min[0], x - radius),
    //                 Math.min(bounds.min[1], y - radius),
    //             ] as Vec2,
    //             max: [
    //                 Math.max(bounds.max[0], x + radius),
    //                 Math.max(bounds.max[1], y + radius),
    //             ] as Vec2,
    //         };
    //     },
    //     {
    //         min: [Infinity, Infinity] as Vec2,
    //         max: [-Infinity, -Infinity] as Vec2,
    //     }
    // );
    const bounds = {
        min: {x: 0, y: 0}  as Vec2,
        max: {x: 0, y: 0}  as Vec2,
    };

    return queue({
        op: "create",
        args: args,
        ret: ref(bounds),
    });
}

const execute = {
    name: "create",
    sequential: true,
    execute: async (context, ...positions) => {
        return await context.impl.create(positions.flat());
    }
} satisfies Execute<typeof create>;

export default {
    lazy: create,
    execute: execute,
};
