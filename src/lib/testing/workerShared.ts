onmessage = (event) => {
    const { data } = event;
    new Uint32Array(data)[0] *= 2;
    postMessage("done");
};
