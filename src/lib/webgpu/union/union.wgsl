#include "tolerance.wgsl"
#include "common.wgsl"

@group(0) @binding(0) var<uniform> settings : Settings;
@group(0) @binding(1) var<storage, read> points: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read> lines: array<Line>;
@group(0) @binding(3) var<storage, read_write> intermediate : array<i32>;
@group(0) @binding(4) var<storage, read_write> output : array<i32>;
@group(0) @binding(5) var<storage, read> shapes : array<u32>;

@group(1) @binding(0) var<uniform> batch : Batch;

struct Line {
    start: vec2<f32>,
    end: vec2<f32>,
}

struct Settings {
    // TOLERANCE: f32
    point_count: u32,
    line_count: u32,
    ray_x: f32,
    // start: u32,
}

struct Batch {
    start: u32,
}

const f32_max = 3.4e10;
const false_float = -10.0;
const false_int = -10;
const false_floats = vec2<f32>(false_float);

const on_perimiter = 5;
const on_perimiter_h = 6;



@compute @workgroup_size(256)
fn main(in: ComputeInput) {
    let id = in.global_id.x + batch.start;
    let line_index = id % settings.line_count;
    let point_index = id / settings.line_count;
    let global_index =  id;

    if (global_index >= settings.point_count * settings.line_count) {
        return;
    }
    // mb use shared memory
    var ln_a: Line;
    ln_a.start = points[point_index];
    ln_a.end = vec2<f32>(settings.ray_x, points[point_index].y);
    
    let ln_b = lines[line_index];

    // let res = intersects(ln_a, ln_b);
    let res = intersects_with_offset(
        vec3<f32>(ln_a.start, 0.0),
        vec3<f32>(ln_a.end, 0.0), 
        vec3<f32>(ln_b.start, 0.0), 
        vec3<f32>(ln_b.end, 0.0)
    );

    if (any(res == false_floats)) {
        intermediate[global_index] = 0;
    }
    else if (res.x == 0.0) { // point starts on line
        if (abs(ln_b.end.y - ln_b.start.y) > TOLERANCE) {
            if (ln_b.end.y > ln_b.start.y) {
                intermediate[global_index] = on_perimiter; // TODO check this
            } else {
                intermediate[global_index] = -on_perimiter; // TODO check this
            }
        } else {
            if (ln_b.end.x > ln_b.start.x) {
                intermediate[global_index] = on_perimiter_h; // TODO check this
            } else {
                intermediate[global_index] = -on_perimiter_h; // TODO check this
            }
        }
    } else {
        if (ln_b.end.y > ln_b.start.y) {
            intermediate[global_index] = 1;
        } else {
            intermediate[global_index] = -1;
        }
    }
    // intermediate[global_index] = i32(point_index);
}

@compute @workgroup_size(256)
fn collect(in: ComputeInput) {
    let id = in.global_id.x;
    let point_index = id;

    if (point_index >= settings.point_count) {
        return;
    }

    let start = point_index * settings.line_count;

    var acc = 0;

    var shape_index = 0u;
    var shape_length = shapes[shape_index];
    var shape_acc = 0;
    var shape_rand = false;

    var perim_up = false;
    var perim_down = false;    

    var perim_up_h = false;
    var perim_down_h = false;
    
    for (var i = 0u; i < settings.line_count; i += 1) {
        let value = intermediate[start + i];
        // acc += intermediate[start + i];

        if (value == on_perimiter) {
            perim_up = true;
            shape_rand = true;
        } else if (value == -on_perimiter) {
            perim_down = true;
            shape_rand = true;
        } else if (value == on_perimiter_h) {
            perim_up_h = true;
            shape_rand = true;
        } else if (value == -on_perimiter_h) {
            perim_down_h = true;
            shape_rand = true;
        } else {
            shape_acc += value;
        }

        shape_length -= 1;
        if (shape_length == 0u) {
            if (perim_up && perim_down) {
                acc += 1;
            } else if (perim_up_h && perim_down_h) {
                acc += 1;
            } else if (!shape_rand && shape_acc != 0) {
                acc += 1;
            }

            if (acc > 0) {
                break;
            }

            shape_index += 1;
            shape_length = shapes[shape_index];
            shape_acc = 0;
            shape_rand = false;
        }
    }

    output[point_index] = acc;
}

fn intersects_with_offset(
   p1: vec3<f32>, p2: vec3<f32>, p3: vec3<f32>, p4: vec3<f32>) -> vec2<f32>
{
    var p1v = p1;
    var p3v = p3;
    var p4v = p4;

    var value: f32;
    if (is_on_line(p3, p4, p1, &value)) {
        // [1, 0, 0, 1, -1, 1, 1, 0]
        // [1, 1, 0, 2,  0, 1, 2, 0]
        // offset p1
        // if (p3.y > p4.y) {
        //     p1v.x -= 2 * eps;
        // } else {
        //     return vec2<f32>(0.0, value);
        // }
        return vec2<f32>(0.0, value);
    }
    if (is_on_line(p3, p4, p2, &value)) {
        return false_floats;
        // return vec2<f32>(1.0, value);
    }

    if (is_on_line(p1, p2, p3, &value)) {
        p3v.y += 4 * TOLERANCE; // TODO plz fix this
        // return vec2<f32>(value, 0.0);
    }
    if (is_on_line(p1, p2, p4, &value)) {
        // offset p4
        p4v.y += 4 * TOLERANCE; // TODO plz fix this
        // return false_floats;

        // return vec2<f32>(value, 1.0);
    }
    
    let p13 = p1v - p3v;
    let p43 = p4v - p3v;
    
    
    if (is_zero_v3(p43)) { // && abs(p43.z) < eps
        return false_floats;
    }
    
    let p21 = p2 - p1v;
    
    if (is_zero_v3(p21)) { //  && abs(p21.z) < eps
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

    let mua = numer / denom;
    let mub = (d1343 + d4321 * (mua)) / d4343;

    let pa = p1v + p21 * mua;
    let pb = p3v + p43 * mub;

    let result = pa - pb;

    let valid_a = is_in_range(mua, 0.0, 1.0);
    let valid_b = is_in_range(mub, 0.0, 1.0);

    if (valid_a && valid_b && is_zero(dot(result, result))) {
        return vec2<f32>(mua, mub);
    }
    return false_floats;
}
