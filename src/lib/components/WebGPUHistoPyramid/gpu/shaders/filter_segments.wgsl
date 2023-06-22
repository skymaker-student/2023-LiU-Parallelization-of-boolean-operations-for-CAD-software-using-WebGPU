#include "tolerance.wgsl"
#include "line_relations.wgsl"
#include "common.wgsl"
#include "constants.wgsl"
#include "pyramid_indexing.wgsl"


@group(0) @binding(0) var<storage, read_write> angles_values: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> pyramid_layers: array<u32>;

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
    mua: f32,
    mub: f32,
}

struct ProcessedRelation {
    error: bool,
    on_perimiter: bool,
    line_winding: i32,
}

// TODO: Fix this algorithm!
// Cannot handle when ray and line points share the y value.
@compute @workgroup_size(256)
fn main(in: ComputeInput) {
    let id = in.global_id.x;
    let offset = index_down(id);
    let start_y = batch_info.batch_id * batch_info.batch_height;

    if (id >= settings.thread_count) {
        return;
    }

    // Grab base coordinates.
    let batch_y = offset / settings.width;

    let x = offset % settings.width;
    let y = batch_y + start_y;

    // Get info about the line we are on.
    let info: i32 = in_shape_info[y];
    let shape: i32 = in_shape_info[y - u32(info < 0)];
    let angle_value = angles_values[offset];
    let angle = angle_value.x;
    let value = abs(angle_value.y);

    // Get the points and vector describing the lines.
    let a = in_shape_points[y];
    let b = in_shape_points[y + 1u - u32(info < 0) * u32(abs(info))];
    let ab = b - a;

    // Find where the next line segment starts.
    var next_value = infinity();
    let start = offset - x;
    for (var i = 0u; i < settings.line_count; i += 1u) {
        let check_value = abs(angles_values[start + i].y);
        if (
            is_less(value, check_value) && 
            is_less(check_value, next_value)
        ) {
            next_value = check_value;
        }
    }

    let middle_value = (value + next_value) / 2; // This denominator has a large impact, any value other than 2 creates a mess!
    let mid = a + middle_value * ab;

    let filter_point = point_strict_in_polygons(mid, shape);

    angles_values[offset].x = angle + 2 * TWO_PI * f32(filter_point);
}

struct Line {
    a: vec2<f32>,
    b: vec2<f32>,
}
fn point_strict_in_polygons(p: vec2<f32>, ignore: i32) -> bool {
    var shape_intersections = 0;
    var on_shape_perimiter = false;
    var inside_count = 0;

    let ray = create_ray(p);

    for (var i = 0u; i < settings.line_count; i++) {        
        let info = in_shape_info[i];
        let end = info < 0;
        let shape = in_shape_info[i - u32(end)];
        
        if (ignore == shape) { continue; }
        if (end && on_shape_perimiter) {
            on_shape_perimiter = false;
            shape_intersections = 0;
            continue;
        }
        if (on_shape_perimiter) { continue; }

        let a = in_shape_points[i];
        let b = in_shape_points[i + 1 - u32(end) * u32(abs(info))];

        let line = Line(a, b);

        let intersect = intersect(ray, line);

        on_shape_perimiter = intersect == ON;
        shape_intersections += i32(intersect == YES);

        inside_count += i32(end) * i32(!on_shape_perimiter) * i32(shape_intersections % 2 != 0);
        shape_intersections *= i32(!end);
    }

    return inside_count > 0;
}

fn create_ray(inside: vec2<f32>) -> Line {
    // let tol = (settings.max_x - settings.min_x) / 1000000.0;
    // let outside = vec2<f32>(settings.min_x - tol, settings.min_y);
    let outside = vec2<f32>(settings.max_x + 1.0, inside.y);
    return Line(inside, outside);
}

const NO:  i32 = -1;
const ON:  i32 =  0;
const YES: i32 =  1;
const BOTH_VERTICAL: i32 = 2;
const RAY_VERTICAL:  i32 = 3;
const LINE_VERTICAL: i32 = 4;
fn intersect(ray: Line, line: Line) -> i32 {
    var garbage = 0.0;

    // If ray start is on line, return ON.
    if (
        is_on_line(
            vec3<f32>(line.a, 0.0),
            vec3<f32>(line.b, 0.0),
            vec3<f32>(ray.a, 0.0),
            &garbage
        )
    ) { return ON; }

    // Each point in the line needs to be skewed,
    // if it has the same y value as the ray.
    let line_a_skews = i32(is_equal(ray.a.y, line.a.y)) * ULP;
    let line_b_skews = i32(is_equal(ray.a.y, line.b.y)) * ULP;

    var line_a_y = line.a.y;
    if (f32_ulps(line_a_y, line_a_y + 2.0 * TOLERANCE)) {
        for (var i = 0; i < line_a_skews; i++) {
            line_a_y = f32_next(line_a_y);
        }
    } else {
        line_a_y += 2 * TOLERANCE;
    }

    var line_b_y = line.b.y;
    if (f32_ulps(line_b_y, line_b_y + 2.0 * TOLERANCE)) {
        for (var i = 0; i < line_b_skews; i++) {
            line_b_y = f32_next(line_b_y);
        }
    } else {
        line_b_y += 2 * TOLERANCE;
    }

    let p1 = ray.a;
    let p2 = ray.b;
    let p3 = vec2<f32>(line.a.x, line_a_y);
    let p4 = vec2<f32>(line.b.x, line_b_y);    

    let p13 = p1 - p3;
    let p43 = p4 - p3;
    let p21 = p2 - p1;

    let d1343 = dot(p13, p43);
    let d4321 = dot(p43, p21);
    let d1321 = dot(p13, p21);
    let d4343 = dot(p43, p43);
    let d2121 = dot(p21, p21);

    let denom = d2121 * d4343 - d4321 * d4321;

    if (is_zero(denom)) { return NO; }
    
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
        return YES;
    }
    return NO;


}
