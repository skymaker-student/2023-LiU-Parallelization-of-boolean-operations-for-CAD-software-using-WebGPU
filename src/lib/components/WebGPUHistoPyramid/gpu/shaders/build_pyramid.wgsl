#include "common/compute_input.wgsl"
#include "common/comparison.wgsl"
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

@group(1) @binding(0) var<uniform> batch_info: BatchInfo;
struct BatchInfo {
    batch_id: u32,
    batch_width: u32,
    batch_height: u32,
}

@group(2) @binding(0) var<uniform> layer_settings : LayerSettings;
struct LayerSettings {
    lower_start: u32,
    upper_dim: u32,
    layers: u32,
    layer: u32,
}

@compute @workgroup_size(256)
fn main(in: ComputeInput) {
    let layer = layer_settings.layer;
    let layers = layer_settings.layers;

    // These are the coordinates for where we are going to write
    let id = in.global_id.x;

    let x = id % layer_settings.upper_dim;
    let y = id / layer_settings.upper_dim;

    if (y >= layer_settings.upper_dim) {
        return;
    }


    // First middle layer
    if (layer == layers - 1) {
        baseLayerRead(x, y);
    } 
    // Last middle layer
    // Other middle layers
    else {
        middleLayerRead(x, y);
    }
}


fn baseLayerRead(x: u32, y: u32) {
    let upper_dim = layer_settings.upper_dim;
    let lower_dim = 2 * upper_dim;
    let upper_offset = upper_dim * y + x;

    // TODO: This can only handle Intersect now.
    pyramid_layers[upper_offset] =
        parse(angles_values[upper_offset * 4 + 0]) +
        parse(angles_values[upper_offset * 4 + 1]) +
        parse(angles_values[upper_offset * 4 + 2]) +
        parse(angles_values[upper_offset * 4 + 3]);
}

fn parse(val: vec2<f32>) -> u32 {
    // An angle of 0.0 should be handled seperately!
    return u32(!is_equal(val.x, 0.0) && is_less(abs(val.x), TWO_PI) && is_less(abs(val.y), 1.0));
}

fn middleLayerRead(x: u32, y: u32) {
    let upper_dim = layer_settings.upper_dim;
    let lower_dim = 2 * upper_dim;
    let start = layer_settings.lower_start;
    let end = start + lower_dim * lower_dim;

    let upper_offset = upper_dim * y + x;

    pyramid_layers[end + upper_offset] = 
        pyramid_layers[start + upper_offset * 4 + 0] + 
        pyramid_layers[start + upper_offset * 4 + 1] +
        pyramid_layers[start + upper_offset * 4 + 2] +
        pyramid_layers[start + upper_offset * 4 + 3];
}
