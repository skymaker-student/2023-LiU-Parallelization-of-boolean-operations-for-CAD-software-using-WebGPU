import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";

export type World = ReturnType<typeof initWorld>;

export function initWorld(canvas: HTMLCanvasElement) {
    if (canvas.parentElement === null) {
        throw new Error("Canvas must have a parent element");
    }

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 1000);
    camera.position.z = 25;

    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0xffffff, 0);
    renderer.setPixelRatio(window.devicePixelRatio);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0px";
    labelRenderer.domElement.style.pointerEvents = "none";
    canvas.parentElement.appendChild(labelRenderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false;
    const state = JSON.parse(localStorage.getItem("camera") ?? "null");
    if (state) {
        controls.target0 = state.target;
        controls.position0 = state.position;
        (controls as any).zoom0 = state.zoom;
        controls.reset();
    }

    function updateControls() {
        controls.update();
        const state = {
            target: controls.target,
            position: controls.object.position,
            zoom: (controls.object as any).zoom,
        };
        localStorage.setItem("camera", JSON.stringify(state));
    }

    function requestRender() {
        requestAnimationFrame(() => {
            updateControls();
            renderer.render(scene, camera);
            labelRenderer.render(scene, camera);
        });
    }

    function render() {
        updateControls();
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
    }

    function animate() {
        updateControls();
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    function reset() {
        scene.clear();

        labelRenderer.domElement.innerHTML = "";
    }

    function onClick(callback: (names: string[]) => void) {
        canvas.addEventListener(
            "click",
            (event) => {
                const bounds = canvas.getBoundingClientRect();
                const mouse = {
                    x: ((event.clientX - bounds.left) / canvas.clientWidth) * 2 - 1,
                    y: -((event.clientY - bounds.top) / canvas.clientHeight) * 2 + 1,
                };
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(scene.children, true);

                const names = intersects.map((i) => i.object.name).filter((n) => n);
                callback(names);
            },
            false
        );
    }

    return {
        scene,
        requestRender,
        animate,
        render,
        reset,
        onClick,
        canvas,
    };
}
