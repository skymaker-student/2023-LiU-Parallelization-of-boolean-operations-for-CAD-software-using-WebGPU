import type { Execute } from ".";
import {
    bounds,
    type UnionOp,
    type GraphContext,
    type Input,
    type Bounds,
    isRef,
    isValue,
} from "../graph";

function union(context: GraphContext, ...geometry: Input<Geometry>[]) {
    const { ref, value, fromInput, fromInputGeometry, queue } = context;

    const args = geometry.map(fromInputGeometry);

    return queue({
        op: "union",
        args: args,
        ret: ref(bounds(args)),
    });
}

function collides(a: Bounds, b: Bounds) {
    // true if a and b overlap
}

const execute = {
    name: "union",
    sequential: false,
    execute: async (context, ...geometry) => {
        return await context.impl.union(geometry.flat());
    },
    batch: async (context, args) => {
        // TODO batch union
        const res = await Promise.all(
            args.map((geometry) => {
                return context.impl.union(geometry.flat());
            })
        );
        return res;
    },
    merge: (self, other) => {
        if (other.op !== "union") return null;
        const s = self as UnionOp;
        const o = other as UnionOp;

        // merge if one of the operations arguments is the others result
        if (s.args.includes(o.ret) || o.args.includes(s.ret)) {
            // make sure the arguments are unique
            const args = [...s.args, ...o.args].filter((a) => a !== s.ret && a !== o.ret);
            for (let i = 0; i < args.length; i++) {
                for (let j = i + 1; j < args.length; j++) {
                    let a = args[i];
                    let b = args[j];

                    if (isRef(a) && isRef(b)) {
                        if (a.id === b.id) {
                            args.splice(j, 1);
                            j--;
                        }
                    } else if (isValue(a) && isValue(b)) {
                        if (a.value === b.value) {
                            args.splice(j, 1);
                            j--;
                        }
                    }
                }
            }

            return {
                op: "union",
                args: args,
                ret: o.ret,
            };
        }

        return null;
    },
} satisfies Execute<typeof union>;

export default {
    lazy: union,
    execute: execute,
};
