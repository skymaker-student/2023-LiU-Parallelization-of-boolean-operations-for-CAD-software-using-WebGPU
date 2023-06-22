@group(0) @binding(0) var<uniform> settings : Settings;
@group(0) @binding(1) var<storage> pyramid: array<u32>;

struct Settings {
    iteration: u32,
    depth: u32,
}

struct ComputeInput {
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(local_invocation_index) local_index: u32,
    @builtin(workgroup_id) wg_id : vec3<u32>,
    @builtin(num_workgroups) wg_count : vec3<u32>,
    @builtin(global_invocation_id) global_id: vec3<u32>
}

override workgroup_size: u32;

@compute @workgroup_size(workgroup_size)
fn build(in: ComputeInput) {
    let current_layer = settings.depth - settings.iteration;
    let current_layer_size = 1 << current_layer;
    let current_layer_size_squared = current_layer_size * current_layer_size;

    let layer_offset = layerOffset(current_layer);
    let start = in.global_id.x + layer_offset;
    let output_index = in.global_id.x + layer_offset + layerNext(current_layer);

    pyramid[output_index] = pyramid[start] + pyramid[start + 1] + pyramid[start + 2] + pyramid[start + 3];
}

// structure of the pyramid @ depth 3
// [ 2 2 2 2  2 2 2 2  2 2 2 2  1 1 1 1  0 ]
fn layerOffset(layer) {
  	var index = 0;
  	for (var i = 0; i < settings.depth - layer; ++i) {
        index += 1 << ((settings.depth - i) * 2);
    }
    return index;
}

fn layerNext(layer) {
    return 1 << ((layer) * 2);
}

@compute @workgroup_size(workgroup_size)
fn filter(in: ComputeInput) {
    
}
