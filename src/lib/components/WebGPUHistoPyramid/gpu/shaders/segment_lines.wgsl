#include "tolerance.wgsl"
#include "line_relations.wgsl"
#include "common.wgsl"
#include "constants.wgsl"



@group(0) @binding(0) var<storage, read_write> angles_values: array<vec2<f32>>;

@group(0) @binding(2) var<uniform> settings: Settings;
struct Settings {
    width: u32,
    thread_count: u32,
    line_count: u32,
    write_self: i32,
    max_x: f32,
    layers: u32,
}

@group(1) @binding(0) var<storage, read> in_shape_info: array<i32>;
@group(1) @binding(1) var<storage, read> in_shape_points: array<vec2<f32>>;

@group(2) @binding(0) var<uniform> batch_info: BatchInfo;
struct BatchInfo {
    batch_id: u32,
    batch_width: u32,
    batch_height: u32,
}

struct Relation {
    rel: i32,
    val: f32,
}

// This is used when we don't know if there is better alternative to store

@compute @workgroup_size(256)
fn main(in: ComputeInput) {
    let id = in.global_id.x;
    let start_y = batch_info.batch_id * batch_info.batch_height;
    let batch_y = id / settings.width;
    let x = id % settings.width; // width instead?
    let y = batch_y + start_y;

    if (id >= batch_info.batch_width * batch_info.batch_height) {
        return;
    }
    
    if (y >= settings.line_count || x >= settings.line_count) {
        angles_values[settings.width * batch_y + x] = vec2(0.0, 5*FALSE_FLOAT);
        return;
    }

    if (x == y) {
         // Diagonal.
        angles_values[settings.width * batch_y + x] = vec2(0.0, 5*FALSE_FLOAT);
        return;
    }

    let a_info = in_shape_info[y];
    let c_info = in_shape_info[x];

    let a = in_shape_points[y];
    var b = in_shape_points[y + 1 - u32(a_info < 0) * u32(abs(a_info))];
    let c = in_shape_points[x];
    var d = in_shape_points[x + 1 - u32(c_info < 0) * u32(abs(c_info))];

    let angle =        find_angle(a, b, c, d);
    let s     = find_intersection(a, b, c, d);

    angles_values[settings.width * batch_y + x] = vec2(angle, s);
}

fn find_intersection(
   a: vec2<f32>, b: vec2<f32>, c: vec2<f32>, d: vec2<f32>
) -> f32 {

    let p1 = vec3<f32>(a, 0.0);
    let p2 = vec3<f32>(b, 0.0);
    let p3 = vec3<f32>(c, 0.0);
    let p4 = vec3<f32>(d, 0.0);

    var a_loc: f32;
    var b_loc: f32;
    var c_loc: f32;
    var d_loc: f32;

    let a_is_b = is_equal_v3(p1, p2);
    let a_is_c = is_equal_v3(p1, p3);
    let a_is_d = is_equal_v3(p1, p4);
    let b_is_c = is_equal_v3(p2, p3);
    let b_is_d = is_equal_v3(p2, p4);
    let c_is_d = is_equal_v3(p3, p4);

    let a_in_cd = is_on_line(p3, p4, p1, &a_loc);
    let b_in_cd = is_on_line(p3, p4, p2, &b_loc);
    let c_in_ab = is_on_line(p1, p2, p3, &c_loc);
    let d_in_ab = is_on_line(p1, p2, p4, &d_loc);

    // Cannot travel backwards on this line
    if (a_is_d) { return -TOLERANCE; }

    // Check that lines are not points
    if (a_is_b || c_is_d) { return 2*FALSE_FLOAT; }

    // Check Cancel
    if (a_is_c && b_is_d)  { return 0.0; }

    // Check Rip && Ripped && Explode && Implode
    if (a_in_cd && b_in_cd && a_loc > b_loc) { return   0.0; }  // Rip
    if (c_in_ab && d_in_ab && c_loc > d_loc) { return d_loc; }  // Ripped
    if (a_in_cd && c_in_ab) { return c_loc; }   // Explode
    if (b_in_cd && d_in_ab) { return d_loc; }   // Implode

    // Check Covers
    if (!a_in_cd && b_in_cd && c_in_ab && !d_in_ab) { return c_loc; }   // Pre
    if (a_in_cd && !b_in_cd && !c_in_ab && d_in_ab) { return 0.0; }   // Pro
    if (a_in_cd && b_in_cd) { return   0.0; }   // Covered && Covered Start && Covered End
    if (c_in_ab && d_in_ab) { return c_loc; }   // Cover   &&   Cover Start &&   Cover End

    // // Check Clockwise Crash
    if (b_in_cd) { return    1.0; } // Crash into them
    if (d_in_ab) { return -d_loc; } // Crash into us


    // Intersection
    let p13 = p1 - p3;
    let p43 = p4 - p3;
    let p21 = p2 - p1;

    let d1343 = dot(p13, p43);
    let d4321 = dot(p43, p21);
    let d1321 = dot(p13, p21);
    let d4343 = dot(p43, p43);
    let d2121 = dot(p21, p21);

    let denom = d2121 * d4343 - d4321 * d4321;

    if (is_zero(denom)) { return 3*FALSE_FLOAT; }
    
    let numer = d1343 * d4321 - d1321 * d4343;

    var mua = numer / denom;
    var mub = (d1343 + d4321 * (mua)) / d4343;

    let pa = p1 + p21 * mua;
    let pb = p3 + p43 * mub;

    let result = pa - pb;

    let valid_a = is_in_range(mua, 0.0, 1.0);
    let valid_b = is_in_range(mub, 0.0, 1.0);
    let valid_r = is_zero(dot(result, result));

    if (valid_a && valid_b && valid_r) {
        if (is_equal(mub, 1.0)) {
            return FALSE_FLOAT;
        } else {
            return mua;
        }
    }
    return 4*FALSE_FLOAT;
}

fn find_angle(
   a: vec2<f32>, b: vec2<f32>, c: vec2<f32>, d: vec2<f32>
) -> f32 {
    let p1 = vec3<f32>(a, 0.0);
    let p2 = vec3<f32>(b, 0.0);
    let p3 = vec3<f32>(c, 0.0);
    let p4 = vec3<f32>(d, 0.0);

    let ab = p2 - p1;
    let cd = p4 - p3;

    var angle = atan2(cd.y, cd.x) - atan2(ab.y, ab.x);

    if angle < -PI {
        angle += TWO_PI;
    }

    if angle > PI {
        angle -= TWO_PI;
    }

    return angle;
}
