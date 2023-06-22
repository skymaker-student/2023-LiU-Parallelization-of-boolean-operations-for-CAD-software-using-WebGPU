declare type Option<T> = T | null;

declare type Vec2 = {
    x: number;
    y: number;
};
declare type Shape = {
    nodes: Vec2[];
    contour?: number[];
    holes?: Vec2[][];
};
declare type BoundShape = Shape & {
    bounds: Bounds;
};
declare type Geometry = Shape[];

declare type Line = {
    start: Vec2;
    end: Vec2;
};

declare type AwaitedRet<T> = Awaited<ReturnType<T>>;


declare type u32 = number;
declare type i32 = number;
declare type f32 = number;
