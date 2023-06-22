import WorkerMessage from "./workerMessage?worker";
import WorkerShared from "./workerShared?worker";

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const workerMessage = new WorkerMessage();
await new Promise<void>(async (resolve) => {
    await sleep(200);

    console.time("worker message");

    workerMessage.onmessage = (event) => {
        console.timeEnd("worker message");
        console.log(event.data);
        resolve();
    };

    workerMessage.postMessage({ data: 10 });
});


/// 

const workerShared = new WorkerShared();
const bufferShared = new SharedArrayBuffer(4);
const dataShared = new Uint32Array(bufferShared);
await new Promise<void>(async (resolve) => {
    dataShared[0] = 10;
    await sleep(200);

    console.time("worker shared");

    workerShared.onmessage = (event) => {
        console.timeEnd("worker shared");
        console.log(dataShared[0]);
        resolve();
    };

    workerShared.postMessage(bufferShared);

    workerShared.postMessage(bufferShared);


    
});
