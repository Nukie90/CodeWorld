import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

function FunctionMoleculeVisualization({ file, isDarkMode, onBack, onFunctionClick }) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const animationIdRef = useRef(null);
    const cameraRef = useRef(null);

    const [hoveredFunction, setHoveredFunction] = useState(null);
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

    const keysRef = useRef({});
    const moveSpeed = 0.5;

    // Color helper
    const getComplexityColor = (complexity) => {
        if (complexity === undefined || complexity === null || complexity === 0) {
            return 0x6b7280; // Gray
        }

        const normalized = Math.min(complexity / 20, 1); // Cap at 20 for color scaling

        if (isDarkMode) {
            // Neon Gradient: Cyan -> Pink -> Purple -> Red
            if (normalized < 0.33) {
                const t = normalized * 3;
                return new THREE.Color(0x06b6d4).lerp(new THREE.Color(0xec4899), t).getHex();
            } else if (normalized < 0.66) {
                const t = (normalized - 0.33) * 3;
                return new THREE.Color(0xec4899).lerp(new THREE.Color(0xa855f7), t).getHex();
            } else {
                const t = (normalized - 0.66) * 3;
                return new THREE.Color(0xa855f7).lerp(new THREE.Color(0xff0055), t).getHex();
            }
        }

        // Light mode: Green -> Yellow -> Red
        if (normalized < 0.5) {
            const t = normalized * 2;
            const r = Math.round(16 + t * (245 - 16));
            const g = Math.round(185 - t * (185 - 158));
            const b = Math.round(129 - t * (129 - 11));
            return (r << 16) | (g << 8) | b;
        } else {
            const t = (normalized - 0.5) * 2;
            const r = Math.round(245 + t * (244 - 245));
            const g = Math.round(158 - t * (158 - 63));
            const b = Math.round(11 + t * (94 - 11));
            return (r << 16) | (g << 8) | b;
        }
    };

    useEffect(() => {
        if (!mountRef.current || !file) return;

        // Cleanup previous
        if (mountRef.current.hasChildNodes()) {
            while (mountRef.current.firstChild) {
                mountRef.current.removeChild(mountRef.current.firstChild);
            }
        }

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Sky/Background
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        const gradient = context.createLinearGradient(0, 0, 0, 512);
        if (isDarkMode) {
            gradient.addColorStop(0, '#020617');
            gradient.addColorStop(1, '#1e293b');
            scene.fog = new THREE.Fog(0x0f172a, 50, 300);
        } else {
            gradient.addColorStop(0, '#0ea5e9');
            gradient.addColorStop(1, '#e0f2fe');
            scene.fog = new THREE.Fog(0x7dd3fc, 50, 300);
        }
        context.fillStyle = gradient;
        context.fillRect(0, 0, 2, 512);
        scene.background = new THREE.CanvasTexture(canvas);

        // Camera
        const camera = new THREE.PerspectiveCamera(
            60,
            mountRef.current.clientWidth / mountRef.current.clientHeight,
            0.1,
            1000
        );
        camera.position.set(0, 40, 100);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, isDarkMode ? 0.5 : 0.7);
        scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(isDarkMode ? 0xa5b4fc : 0xffffff, isDarkMode ? 1.2 : 1.5);
        mainLight.position.set(30, 50, 30);
        mainLight.castShadow = true;
        scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(isDarkMode ? 0x6366f1 : 0xffffff, isDarkMode ? 0.6 : 0.4);
        fillLight.position.set(-30, 20, -30);
        scene.add(fillLight);

        // Arrays for cleanup
        const geometriesToDispose = [];
        const materialsToDispose = [];
        const functionBlocks = [];

        // --- Build Function Blocks ---
        const functions = file.functions || [];

        // Arrange blocks in a grid from left to right, top to bottom
        const blocksPerRow = Math.ceil(Math.sqrt(functions.length));
        const blockSpacing = 12;
        const blockWidth = 8;
        const blockDepth = 8;

        functions.forEach((fn, index) => {
            const row = Math.floor(index / blocksPerRow);
            const col = index % blocksPerRow;

            // Position in grid
            const x = (col - blocksPerRow / 2) * blockSpacing;
            const z = (row - Math.ceil(functions.length / blocksPerRow) / 2) * blockSpacing;

            // Height based on LOC
            const height = Math.max(3, Math.min(30, (fn.nloc || 1) * 0.3));

            const blockGeo = new THREE.BoxGeometry(blockWidth, height, blockDepth);
            const blockColor = getComplexityColor(fn.cyclomatic_complexity);
            const blockMat = new THREE.MeshStandardMaterial({
                color: blockColor,
                roughness: 0.4,
                metalness: 0.6,
                emissive: blockColor,
                emissiveIntensity: isDarkMode ? 0.4 : 0.2
            });

            const block = new THREE.Mesh(blockGeo, blockMat);
            block.position.set(x, height / 2, z);
            block.castShadow = true;
            block.receiveShadow = true;

            block.userData = {
                type: 'function',
                name: fn.name,
                nloc: fn.nloc,
                complexity: fn.cyclomatic_complexity,
                start_line: fn.start_line,
                filename: file.filename,
                originalEmissive: isDarkMode ? 0.4 : 0.2,
                index: index
            };

            scene.add(block);
            functionBlocks.push(block);
            geometriesToDispose.push(blockGeo);
            materialsToDispose.push(blockMat);

            // Add base platform
            const baseGeo = new THREE.BoxGeometry(blockWidth + 0.5, 0.5, blockDepth + 0.5);
            const baseMat = new THREE.MeshStandardMaterial({
                color: isDarkMode ? 0x1e293b : 0x94a3b8,
                roughness: 0.8,
                metalness: 0.2
            });
            const base = new THREE.Mesh(baseGeo, baseMat);
            base.position.set(x, 0.25, z);
            base.receiveShadow = true;
            scene.add(base);
            geometriesToDispose.push(baseGeo);
            materialsToDispose.push(baseMat);
        });

        // Add floor
        const floorGeo = new THREE.PlaneGeometry(200, 200);
        const floorMat = new THREE.MeshStandardMaterial({
            color: isDarkMode ? 0x0f172a : 0xe0f2fe,
            roughness: 0.9,
            metalness: 0.1
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        scene.add(floor);
        geometriesToDispose.push(floorGeo);
        materialsToDispose.push(floorMat);

        // Interaction
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const onMouseMove = (event) => {
            if (!mountRef.current) return;
            const rect = mountRef.current.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            setHoverPosition({ x: event.clientX + 15, y: event.clientY });

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(functionBlocks);

            // Reset all
            functionBlocks.forEach(block => {
                if (block.material.emissive) {
                    block.material.emissiveIntensity = block.userData.originalEmissive;
                }
            });

            if (intersects.length > 0) {
                const block = intersects[0].object;
                setHoveredFunction(block.userData);
                // Highlight
                if (block.material.emissive) {
                    block.material.emissiveIntensity = isDarkMode ? 1.0 : 0.8;
                }
            } else {
                setHoveredFunction(null);
            }
        };

        const onMouseClick = (event) => {
            if (!mountRef.current) return;
            const rect = mountRef.current.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(functionBlocks);

            if (intersects.length > 0 && onFunctionClick) {
                const block = intersects[0].object;
                const userData = block.userData;
                onFunctionClick({
                    filename: userData.filename,
                    functionName: userData.name,
                    startLine: userData.start_line,
                    nloc: userData.nloc
                });
            }
        };

        mountRef.current.addEventListener('mousemove', onMouseMove);
        mountRef.current.addEventListener('click', onMouseClick);

        // Keyboard controls
        const handleKeyDown = (e) => keysRef.current[e.key.toLowerCase()] = true;
        const handleKeyUp = (e) => keysRef.current[e.key.toLowerCase()] = false;
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // Animation Loop
        let time = 0;
        const animate = () => {
            animationIdRef.current = requestAnimationFrame(animate);
            time += 0.01;

            // Camera controls
            const keys = keysRef.current;
            const moveVec = new THREE.Vector3();
            if (keys['w']) moveVec.z -= moveSpeed;
            if (keys['s']) moveVec.z += moveSpeed;
            if (keys['a']) moveVec.x -= moveSpeed;
            if (keys['d']) moveVec.x += moveSpeed;
            if (keys['q']) moveVec.y += moveSpeed;
            if (keys['e']) moveVec.y -= moveSpeed;

            if (moveVec.length() > 0) {
                moveVec.applyQuaternion(camera.quaternion);
                camera.position.add(moveVec);
            }

            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
            if (!mountRef.current) return;
            camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);

            if (mountRef.current) {
                mountRef.current.removeEventListener('mousemove', onMouseMove);
                mountRef.current.removeEventListener('click', onMouseClick);
                if (renderer.domElement && mountRef.current.contains(renderer.domElement)) {
                    mountRef.current.removeChild(renderer.domElement);
                }
            }

            geometriesToDispose.forEach(g => g.dispose());
            materialsToDispose.forEach(m => m.dispose());
            renderer.dispose();
        };
    }, [file, isDarkMode, onFunctionClick]);

    return (
        <div className="relative w-full h-full">
            <div ref={mountRef} className="w-full h-full" style={{ minHeight: '55vh' }} />

            {/* Back Button */}
            <div className="absolute top-4 left-4 z-50">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-xl shadow-lg hover:scale-105 transition-all border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-gray-100 font-bold"
                >
                    <span>← Back to Island</span>
                </button>
                {file && (
                    <div className="mt-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                        <h2 className="text-xl font-black bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                            {file.name}
                        </h2>
                        <div className="flex gap-4 mt-2 text-sm text-gray-600 dark:text-gray-300">
                            <span>Functions: <b>{file.numFunctions}</b></span>
                            <span>LOC: <b>{file.totalLoc}</b></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Hover Tooltip */}
            {hoveredFunction && (
                <div
                    className="fixed z-50 pointer-events-none"
                    style={{
                        left: `${hoverPosition.x}px`,
                        top: `${hoverPosition.y}px`,
                        transform: 'translateY(-50%)'
                    }}
                >
                    <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-2xl p-4 border border-gray-200/50 dark:border-slate-700/50">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `#${getComplexityColor(hoveredFunction.complexity).toString(16).padStart(6, '0')}` }} />
                            <span className="font-bold text-gray-900 dark:text-gray-100">{hoveredFunction.name}</span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                            <div className="flex justify-between gap-4">
                                <span>Complexity:</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">{hoveredFunction.complexity}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span>LOC:</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">{hoveredFunction.nloc}</span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                                Click to view code
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Controls Help */}
            <div className="absolute bottom-4 left-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-xl shadow-lg p-4 z-10 border border-white/50 dark:border-slate-700/50">
                <h4 className="font-bold text-sm mb-2 text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span className="text-base">🎮</span> Controls
                </h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-[10px] font-mono">WASD</kbd>
                        <span>Move Camera</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-[10px] font-mono">Q/E</kbd>
                        <span>Up/Down</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-[10px] font-mono">Click</kbd>
                        <span>View Code</span>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 right-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-xl shadow-lg p-4 z-10 border border-white/50 dark:border-slate-700/50">
                <h4 className="font-bold text-sm mb-3 text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span className="text-base">📊</span> Function Blocks
                </h4>
                <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-6 bg-blue-500 rounded-sm" />
                        <span>Height = Lines of Code</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 rounded-full w-16" />
                        <span>Color = Complexity</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Ordered from first to last
                    </div>
                </div>
            </div>
        </div>
    );
}

export default FunctionMoleculeVisualization;
