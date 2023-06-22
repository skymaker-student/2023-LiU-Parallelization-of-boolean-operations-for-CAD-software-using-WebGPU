#include "common/compute_input.wgsl"

@group(0) @binding(0) var<storage, read> in_winding_shape: array<i32>;
@group(1) @binding(0) var<storage, read_write> out_shape: array<i32>;

// Hole inside shape reduce
@compute @workgroup_size(256)
fn main(in: ComputeInput) {
    let hole_count = arrayLength(&out_shape);
    let line_count = arrayLength(&in_winding_shape) / hole_count;

    let id = in.global_id.x;

    if (id >= hole_count) {
        return;
    }

    var winding: i32 = 0;
    let start = id * line_count;
    for (var x = 0u; x < line_count; x++) {
        winding += in_winding_shape[start + x];
    }

    if (winding == 0) {
        out_shape[id] = -1;
        return;
    }



    out_shape[id] = abs(winding) - 1;
}
