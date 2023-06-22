import { MATH } from "$skymaker";
import { TOLERANCE, ULP } from "$webgpu/common/constants";

export const Compare = { ...skymaker(), change };
function change(implementation: "ulp" | "skymaker" = "skymaker", option?: u32) {
    let imp;
    switch (implementation) {
        case "ulp":
            imp = ulp(option);
            break;
        case "skymaker":
            imp = skymaker(option);
            break;
    }

    Object.assign(Compare, imp);
}

type Implementation = {
    name: string;
    equal: (a: number, b: number) => boolean;
    zero: (a: number) => boolean;
    less: (a: number, b: number) => boolean;
    greater: (a: number, b: number) => boolean;
    lessOrEqual: (a: number, b: number) => boolean;
    greaterOrEqual: (a: number, b: number) => boolean;
};

function ulp(bits: u32 = ULP) {
    return {
        name: "ulp",
        equal: (a, b) => a === b || Math.abs(a - b) <= TOLERANCE || ulpEqual(a, b, bits),
        zero: (a) => a === 0 || Math.abs(a) <= TOLERANCE || ulpEqual(a, 0, bits),
        less: (a, b) => a < b && Math.abs(a - b) > TOLERANCE && !ulpEqual(a, b, bits),
        greater: (a, b) => a > b && Math.abs(a - b) > TOLERANCE && !ulpEqual(a, b, bits),
        lessOrEqual: (a, b) => a < b || Math.abs(a - b) <= TOLERANCE || ulpEqual(a, b, bits),
        greaterOrEqual: (a, b) => a > b || Math.abs(a - b) <= TOLERANCE || ulpEqual(a, b, bits),
    } satisfies Implementation;
}

function skymaker(decimals: number = 6) {
    return {
        name: "skymaker",
        equal: (a, b) => MATH.isEqual(a, b, decimals),
        zero: (a) => MATH.isZero(a, decimals),
        less: (a, b) => MATH.isLess(a, b, decimals),
        greater: (a, b) => MATH.isGreater(a, b, decimals),
        lessOrEqual: (a, b) => MATH.isLessOrEqual(a, b, decimals),
        greaterOrEqual: (a, b) => MATH.isGreaterOrEqual(a, b, decimals),
    } satisfies Implementation;
}

/// ULP comparison
const ulpBuffer = new ArrayBuffer(2 * 4);
const f32Buffer = new Float32Array(ulpBuffer);
const i32Buffer = new Int32Array(ulpBuffer);
const I32_MIN = -2147483648;
const I32_MAX = 2147483647;

function ulpEqual(a: f32, b: f32, bits: u32): boolean {
    f32Buffer[0] = a;
    f32Buffer[1] = b;

    // https://doc.rust-lang.org/std/primitive.i32.html#method.wrapping_sub
    // Wrapping might be needed here (not sure how to do in JS) (also in wgsl)
    // Might be handled by tolerance
    // test case: 0 and -0
    let wrapped_diff = i32Buffer[0] - i32Buffer[1];

    let saturated_abs;
    if (wrapped_diff < 0) {
        if (wrapped_diff == I32_MIN) {
            saturated_abs = I32_MAX;
        } else {
            saturated_abs = -wrapped_diff;
        }
    } else {
        saturated_abs = wrapped_diff;
    }

    return saturated_abs <= bits;
}
