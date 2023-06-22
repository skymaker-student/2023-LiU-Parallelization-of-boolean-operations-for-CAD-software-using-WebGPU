#include "tolerance.wgsl"
#include "ulp.wgsl"
#include "common/infinity.wgsl"

//// FLOAT COMPARISON ////

const I32_MIN: i32 = -2147483648;
const I32_MAX: i32 = 2147483647;

// https://docs.rs/float-cmp/latest/src/float_cmp/ulps.rs.html#44-57
fn f32_ulps(a: f32, b: f32) -> bool {
    let ia = bitcast<i32>(a);
    let ib = bitcast<i32>(b);

    // https://doc.rust-lang.org/std/primitive.i32.html#method.wrapping_sub
    let wrapped_diff = ia - ib;

    // https://docs.rs/float-cmp/latest/src/float_cmp/macros.rs.html#75-87
    let saturated_abs = 
        // If wrapped_diff is negative,
        i32(wrapped_diff < 0) * (
            // calculate the checked negation
            // wrapped_diff. 
            i32(wrapped_diff == I32_MIN) * (
                I32_MAX
            ) + 
            i32(wrapped_diff != I32_MIN) * (
                -wrapped_diff
            )
        ) + 
        // Else, return wrapped_diff.
        i32(wrapped_diff >= 0) * (
            wrapped_diff
        );

    return saturated_abs <= ULP;
}

// https://docs.rs/float-cmp/latest/src/float_cmp/ulps.rs.html#59-73
fn f32_next(a: f32) -> f32 {
    let ua = bitcast<u32>(a);

    let pos_inf = bitcast<u32>(infinity());
    let is_pos_inf = ua == pos_inf;

    let neg_zero = 2147483648u;
    let pos_zero = 0u;
    let is_neg_zero = ua == neg_zero; //a == -0.0 && ia ^ sign_bit == 0;

    let other = !is_pos_inf && !is_neg_zero;

    let uout = 
        u32(is_pos_inf ) * pos_inf  +
        u32(is_neg_zero) * pos_zero +
        u32(other)       * (
            u32(a >= 0.0) * (ua + 1) +
            u32(a <  0.0) * (ua - 1)
        );

    let out = bitcast<f32>(uout);

    return out;
}

// https://docs.rs/float-cmp/latest/src/float_cmp/ulps.rs.html#75-89
fn f32_prev(a: f32) -> f32 {
    let ua = bitcast<u32>(a);

    let neg_inf = bitcast<u32>(-infinity());
    let is_neg_inf = ua == neg_inf;

    let neg_zero = 2147483648u;
    let pos_zero = 0u;
    let is_pos_zero = ua == pos_zero; //a == -0.0 && ia ^ sign_bit == 0;

    let other = !is_neg_inf && !is_pos_zero;

    let uout = 
        u32(is_neg_inf ) * neg_inf  +
        u32(is_pos_zero) * neg_zero +
        u32(other)       * (
            u32(a <= -0.0) * (ua + 1) +
            u32(a >  -0.0) * (ua - 1)
        );

    let out = bitcast<f32>(uout);

    return out;
}

// https://docs.rs/float-cmp/latest/src/float_cmp/eq.rs.html#92-107
fn is_equal(a: f32, b: f32) -> bool {
    return 
        a == b ||
        abs(a - b) <= TOLERANCE ||
        f32_ulps(a, b);
}

fn is_not_equal(a: f32, b: f32) -> bool {
    return !is_equal(a, b);
}

fn is_greater(a: f32, b: f32) -> bool {
    return !is_equal(a,b) && a > b;
}

fn is_greater_equal(a: f32, b: f32) -> bool {
    return is_equal(a,b) || a > b;
}

fn is_less(a: f32, b: f32) -> bool {
    return !is_equal(a,b) && a < b;
}

fn is_less_equal(a: f32, b: f32) -> bool {
    return is_equal(a,b) || a < b;
}

fn is_zero(a: f32) -> bool {
    return is_equal(a, 0.0);
}

fn is_in_range(x: f32, a: f32, b: f32) -> bool {
    return is_greater_equal(x, a) && is_less_equal(x, b);
}

const CLOSED = false;
const OPEN = true;

fn is_in_interval(x: f32, left_open: bool, right_open: bool, a: f32, b: f32) -> bool {
    return 
        is_in_left_bound( x,  left_open, a) &&
        is_in_right_bound(x, right_open, b);
}

fn is_in_left_bound(x: f32, left_open: bool, bound: f32) -> bool {
    return (left_open  && is_greater(x, bound)) || ( !left_open && is_greater_equal(x, bound));
}

fn is_in_right_bound(x: f32, right_open: bool, bound: f32) -> bool {
    return (right_open &&    is_less(x, bound)) || (!right_open && is_less_equal(x, bound));
}


//// VEC3 FLOAT COMPARISON ////

fn is_equal_v3(a: vec3<f32>, b: vec3<f32>) -> bool {
    return
        all(a == b) ||
        all(abs(a - b) <= vec3<f32>(TOLERANCE)) ||
        (f32_ulps(a.x, b.x) && f32_ulps(a.y, b.y) && f32_ulps(a.z, b.z));
}

fn is_greater_v3(a: vec3<f32>, b: vec3<f32>) -> bool {
    return !is_equal_v3(a,b) && all(a > b);
}

fn is_greater_equal_v3(a: vec3<f32>, b: vec3<f32>) -> bool {
    return is_equal_v3(a,b) || all(a > b);
}

fn is_less_v3(a: vec3<f32>, b: vec3<f32>) -> bool {
    return !is_equal_v3(a,b) && all(a < b);
}

fn is_less_equal_v3(a: vec3<f32>, b: vec3<f32>) -> bool {
    return is_equal_v3(a,b) || all(a < b);
}

fn is_zero_v3(a: vec3<f32>) -> bool {
    return is_equal_v3(a,vec3<f32>(0.0));
}

fn is_in_range_v3(x: vec3<f32>, a: vec3<f32>, b: vec3<f32>) -> bool {
    return is_greater_equal_v3(x, a) && is_less_equal_v3(x, b);
}
