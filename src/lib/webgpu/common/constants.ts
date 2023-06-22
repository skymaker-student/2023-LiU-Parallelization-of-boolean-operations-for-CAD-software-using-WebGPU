export const ULP = 4; // 4
export const TOLERANCE = 0.000001 * 5;
// export const TOLERANCE = 0.00000011920929; // Rust f32::EPSILON
// export const TOLERANCE = 0.00034526698;

// These rescales the shape coordinates
export const NORMALIZE_COORDINATES = false;
export const RESCALE = 64;

export type WEBGPU_TYPE = "i32" | "u32" | "f32" | "boolean";
export const WEBGPU_TYPES_SIZE = 4;

// export function webGPUSize(webGPUType: WEBGPU_TYPE): number {
//     switch (webGPUType) {
//         case "i32":
//             return 4;
//         case "u32":
//             return 4;
//         case "f32":
//             return 4;
//         case "boolean":
//             return 4;
//     }
// }
