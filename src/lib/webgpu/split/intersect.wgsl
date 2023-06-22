#include "tolerance.wgsl"
#include "common.wgsl"

@group(0) @binding(0) var<storage, read> input: array<Line>;
struct Line {
    start: vec2<f32>,
    end: vec2<f32>,
}
@group(0) @binding(1) var<storage, read_write> output : array<vec2<f32>>;
@group(0) @binding(2) var<uniform> settings : Settings;
struct Settings {
    // TOLERANCE: f32,
    count: u32,
    n: u32,
}

@compute @workgroup_size(256)
fn main(in: ComputeInput) {
    if (in.global_id.x >= settings.count) {
        return;
    }
    let x = in.global_id.x % settings.n;
    let y = in.global_id.x / settings.n;

    var i = x;
    var j = y;

    if (x <= y) {
        i = settings.n - 1 - x;
        j = settings.n - 2 - y;
    }

    
    let ln_a = input[j];
    let ln_b = input[i];

    // let res = intersects(ln_a, ln_b);
    let res = intersects(
        vec3<f32>(ln_a.start, 0.0),
        vec3<f32>(ln_a.end, 0.0), 
        vec3<f32>(ln_b.start, 0.0), 
        vec3<f32>(ln_b.end, 0.0)
    );
    
    output[in.global_id.x] = res;
}

const false_float = -10.0;
const false_floats = vec2<f32>(false_float);
fn intersects(
   p1: vec3<f32>, p2: vec3<f32>, p3: vec3<f32>, p4: vec3<f32>) -> vec2<f32>
{

    let p13 = p1 - p3;
    let p43 = p4 - p3;

    var value: f32;
    if (is_on_line(p1, p2, p3, &value)) {
        return vec2<f32>(value, 0.0);
    }
    if (is_on_line(p1, p2, p4, &value)) {
        return false_floats;
        // return vec2<f32>(value, 1.0);
    }
    if (is_on_line(p3, p4, p1, &value)) {
        return vec2<f32>(0.0, value);
    }
    if (is_on_line(p3, p4, p2, &value)) {
        // return false_floats;
        return vec2<f32>(1.0, value);
    }
    
    if (is_zero_v3(p43)) {
        return false_floats;
    }
    
    let p21 = p2 - p1;
    if (is_zero_v3(p21)) {
        return false_floats;
    }

    let d1343 = dot(p13, p43);
    let d4321 = dot(p43, p21);
    let d1321 = dot(p13, p21);
    let d4343 = dot(p43, p43);
    let d2121 = dot(p21, p21);

    let denom = d2121 * d4343 - d4321 * d4321;
    if (is_zero(denom)) {
        return false_floats;
    }
    let numer = d1343 * d4321 - d1321 * d4343;

    var mua = numer / denom;
    var mub = (d1343 + d4321 * (mua)) / d4343;

    let pa = p1 + p21 * mua;
    let pb = p3 + p43 * mub;

    let result = pa - pb;

    let valid_a = is_in_range(mua, 0.0, 1.0);
    let valid_b = is_in_range(mub, 0.0, 1.0);

    if (valid_a && valid_b && is_zero(dot(result, result))) {
        return vec2<f32>(mua, mub);
    }
    return false_floats;
}
