@binding(0) var<uniform> batch_offset: u32;

fn batch_id(in: ComputeInput) -> u32 {
    return in.global_id.x + batch_offset;
}
