#include "tolerance.wgsl"
#include "line_relations.wgsl"
#include "common.wgsl"
#include "constants.wgsl"
#include "pyramid_indexing.wgsl"

@group(0) @binding(0) var<uniform> settings : Settings;
struct Settings {
    width: u32,
    thread_count: u32,
    line_count: u32,
    layers: u32
}

@group(0) @binding(1) var<storage, read> shape_info: array<i32>;
@group(0) @binding(2) var<storage, read> points: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read> top: array<u32>;
@group(0) @binding(4) var<storage, read> middle: array<u32>;
@group(0) @binding(5) var<storage, read_write> enums: array<i32>;
@group(0) @binding(6) var<storage, read_write> values: array<f32>;

@group(1) @binding(0) var<storage, read_write> out_points: array<vec2<f32>>;
// @group(1) @binding(1) var<storage, read_write> out_line: array<u32>;
// @group(1) @binding(2) var<storage, read_write> out_shape: array<u32>;
// @group(1) @binding(3) var<storage, read_write> out_s: array<f32>;

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

// This is used when we don't know if there is better alternative to store
const PLACEHOLDER = FALSE_FLOAT;

@compute @workgroup_size(256)
fn main(in: ComputeInput) {
    if (in.global_id.x >= settings.thread_count) {
        return;
    }

    let offset = index_down(in.global_id.x);

    // Grab base coordinates.
    let x = offset % settings.width;
    let y = offset / settings.width;

    // Get info about the line we are on.
    let info = shape_info[y];
    let shape = shape_info[y - u32(info < 0)];

    // Get the points and vector describing the line.
    let start = points[y];
    let end = points[y + 1u - u32(info < 0) * u32(abs(info))];
    let line = end - start;

    // Grab the s value for the point we are standing on.
    let s = values[offset];
    let point = start + line * s;

    let id = in.global_id.x;
    out_points[id] = point;
    // out_line[id] = u32(y);
    // out_shape[id] = u32(shape);
    // out_s[id] = s;
}

