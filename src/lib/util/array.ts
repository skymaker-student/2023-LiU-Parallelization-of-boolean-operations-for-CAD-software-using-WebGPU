declare global {
    interface Array<T> {
        zip<U>(other: U[]): [T, U][];
    }
}

Array.prototype.zip = function <T, U>(this: T[], other: U[]) {
    return this.map((value, index) => [value, other[index]]);
};

export {};
