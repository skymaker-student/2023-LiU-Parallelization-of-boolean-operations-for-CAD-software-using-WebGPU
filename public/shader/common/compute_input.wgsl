struct ComputeInput {
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(local_invocation_index) local_index: u32,
    @builtin(workgroup_id) wg_id : vec3<u32>,
    @builtin(num_workgroups) wg_count : vec3<u32>,
    @builtin(global_invocation_id) global_id: vec3<u32>
}