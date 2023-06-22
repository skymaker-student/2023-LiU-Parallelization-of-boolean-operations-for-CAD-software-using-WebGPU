#include "tolerance.wgsl"
#include "common.wgsl"
#include "line_relations.wgsl"
#include "pyramid_indexing.wgsl"
#include "constants.wgsl"

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

@group(2) @binding(0) var<storage, read_write> out_shape_info: array<OutShapeInfo>;
struct OutShapeInfo {
    id: u32,
    next: u32,
}
@group(2) @binding(1) var<storage, read_write> out_shape_points: array<vec2<f32>>;

@group(3) @binding(0) var<uniform> batch_info: BatchInfo;
struct BatchInfo {
    batch_id: u32,
    batch_width: u32,
    batch_height: u32,
}


@compute @workgroup_size(256)
fn main(in: ComputeInput) {
    let id = in.global_id.x;

    if (id >= settings.thread_count) {
        return;
    }

    let offset = index_down(id);
    let start_y = batch_info.batch_id * batch_info.batch_height;
    let batch_offset = batch_info.batch_id * batch_info.batch_width * batch_info.batch_height;

    let x = offset % settings.width;
    let y = offset / settings.width + start_y;

    // Find assigned line.
    let line_a_info = in_shape_info[y];
    var line_a_index = y;
    var line_b_index = line_a_index + 1 - u32(line_a_info < 0) * u32(abs(line_a_info)); // Wrap around
    
    // Find the starting point of our assigned line segment.
    let thres = abs(angles_values[offset].y);
    var a = in_shape_points[line_a_index];
    var b = in_shape_points[line_b_index];
    var ab = b - a;

    // If there are no appropriate proceeding line segments,
    // default to the next line's starting point.
    var next_offset = offset;

    // Find the smallest s greater than s from the assigned line segment.
    // var s = 2.0;
    // let start = offset - x;
    // for (var i = 0u; i < settings.line_count; i++) {
    //     let angle_value = angles_values[start + i];
    //     if (is_less(angle_value.y, FALSE_FLOAT)) { continue; }
    //     if (is_in_interval(angle_value.y, OPEN, OPEN, thres, s)) {
    //         s = angle_value.y;
    //         next_offset = start + i;
    //     }
    // }

    var v = 10.0;
    var s = 2.0;
    let start = offset - x;
    for (var i = 0u; i < settings.line_count; i++) {
        let angle_value = angles_values[start + i];
        let angle = angle_value.x - 4.0 * TWO_PI * f32(is_greater(angle_value.x, TWO_PI));
        let value = angle_value.y;
        if (is_less(value, -1.0)) { continue; }
        if (
            is_in_interval(value, OPEN, OPEN, thres, s) 
            ||
            (is_equal(value, s) && is_less(angle, v))
        ) {
            v = angle;
            s = value;
            next_offset = start + i;
        }
    }

    // Transpose coordinates to find the correct offset.
    let current_x = next_offset % settings.width;
    let current_y = next_offset / settings.width + start_y;
    next_offset = current_x * settings.width + current_y;

    // // Write the index of the next contour point.
    out_shape_info[id].id = offset + batch_offset;
    out_shape_info[id].next = next_offset; // index_up(next_offset);
    out_shape_points[id] = a + ab * thres;
}


