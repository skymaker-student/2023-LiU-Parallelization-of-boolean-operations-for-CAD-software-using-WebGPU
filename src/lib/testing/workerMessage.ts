onmessage = (event) => {
    const { data } = event;
    const result = data.data * 2;
    postMessage(result);
};
