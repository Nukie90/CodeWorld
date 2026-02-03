import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as d3 from 'd3';

function Island3DVisualization({ individualFiles, onFunctionClick }) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const animationIdRef = useRef(null);
    const cameraRef = useRef(null);

    const [hoveredObject, setHoveredObject] = useState(null);
    const [hoverInfoPosition, setHoverInfoPosition] = useState({ x: 0, y: 0 });

    const keysRef = useRef({});
    const moveSpeed = 0.5;

    if (!individualFiles || individualFiles.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                No files to visualize
            </div>
        );
    }

    // --- Data Processing Helpers ---

    const calculateFileMetrics = (file) => {
        const functions = file.functions || [];
        const totalLoc = file.nloc || file.loc || functions.reduce((sum, fn) => sum + (fn.nloc || 0), 0) || 1;

        let avgComplexity = 0;
        if (functions.length > 0) {
            const complexities = functions
                .map(fn => fn.cyclomatic_complexity)
                .filter(c => c !== undefined && c !== null);
            if (complexities.length > 0) {
                avgComplexity = complexities.reduce((sum, c) => sum + c, 0) / complexities.length;
            }
        }

        return { totalLoc, avgComplexity, numFunctions: functions.length };
    };

    const buildHierarchy = (files) => {
        const root = { name: "root", children: [] };

        files.forEach(file => {
            const parts = (file.filename || '').split('/');
            let currentLevel = root;

            parts.forEach((part, index) => {
                const isFile = index === parts.length - 1;

                let existingNode = currentLevel.children.find(child => child.name === part);

                if (!existingNode) {
                    if (isFile) {
                        const { totalLoc, avgComplexity, numFunctions } = calculateFileMetrics(file);
                        existingNode = {
                            name: part,
                            type: 'file',
                            fileData: file,
                            value: totalLoc, // D3 pack uses 'value' for size
                            avgComplexity: avgComplexity,
                            totalLoc: totalLoc,
                            numFunctions: numFunctions
                        };
                    } else {
                        existingNode = {
                            name: part,
                            type: 'directory',
                            children: []
                        };
                    }
                    currentLevel.children.push(existingNode);
                }

                if (!isFile) {
                    currentLevel = existingNode;
                }
            });
        });

        return root;
    };

    // Calculate global metrics for coloring
    let allComplexities = [];
    individualFiles.forEach(file => {
        const { avgComplexity } = calculateFileMetrics(file);
        if (avgComplexity > 0) allComplexities.push(avgComplexity);
    });
    const minComplexity = allComplexities.length > 0 ? Math.min(...allComplexities) : 1;
    const maxComplexity = allComplexities.length > 0 ? Math.max(...allComplexities) : 10;

    const getComplexityColor = (complexity) => {
        if (complexity === undefined || complexity === null || complexity === 0) {
            return 0x6b7280; // Gray
        }
        if (maxComplexity === minComplexity) {
            return 0x10b981; // Emerald
        }
        const normalized = (complexity - minComplexity) / (maxComplexity - minComplexity);

        // Green -> Yellow -> Red
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

    // Directory colors based on depth
    const getDirectoryColor = (depth) => {
        // Depth-based terrain colors
        const colors = [
            0xf5d5a8, // Depth 0 (Root) - Sandy
            0xd4c4a8, // Depth 1 - Rockier
            0xa8b8c4, // Depth 2 - Stone
            0x8fa0b0, // Depth 3 - High Stone
            0x788898, // Depth 4 - Peak
        ];
        return colors[Math.min(depth, colors.length - 1)];
    };

    useEffect(() => {
        if (!mountRef.current) return;

        // --- Layout Calculation with D3 ---
        const hierarchyData = buildHierarchy(individualFiles);
        const root = d3.hierarchy(hierarchyData)
            .sum(d => d.value ? Math.sqrt(d.value) : 0) // Sizing files by LOC (sqrt for area mostly)
            .sort((a, b) => b.value - a.value);

        // Pack the circles
        const packLayout = d3.pack()
            .size([400, 400]) // Arbitrary large workspace size
            .padding(d => d.depth === 0 ? 10 : 5);

        packLayout(root);

        // --- Three.js Setup ---

        // Cleanup previous
        if (mountRef.current.hasChildNodes()) {
            while (mountRef.current.firstChild) {
                mountRef.current.removeChild(mountRef.current.firstChild);
            }
        }

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Sky
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        const gradient = context.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, '#0ea5e9'); // Sky blue
        gradient.addColorStop(1, '#e0f2fe'); // Horizon
        context.fillStyle = gradient;
        context.fillRect(0, 0, 2, 512);
        scene.background = new THREE.CanvasTexture(canvas);
        scene.fog = new THREE.Fog(0x7dd3fc, 200, 900);

        // Camera
        const camera = new THREE.PerspectiveCamera(55, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 2000);

        // Center camera roughly
        const islandCenterX = 200;
        const islandCenterZ = 200;

        // Initial position
        camera.position.set(islandCenterX, 200, islandCenterZ + 300);
        camera.lookAt(islandCenterX, 0, islandCenterZ);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        mountRef.current.appendChild(renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.5);
        sunLight.position.set(islandCenterX + 100, 300, islandCenterZ + 100);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 4096;
        sunLight.shadow.mapSize.height = 4096;
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 1000;

        // Adjust shadow frustum to cover the whole island
        const shadowSize = 400;
        sunLight.shadow.camera.left = -shadowSize;
        sunLight.shadow.camera.right = shadowSize;
        sunLight.shadow.camera.top = shadowSize;
        sunLight.shadow.camera.bottom = -shadowSize;
        sunLight.shadow.bias = -0.0005;
        scene.add(sunLight);

        // Fill light
        const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x98FB98, 0.4);
        scene.add(hemiLight);

        // Interaction arrays
        const interactableMeshes = [];
        const geometriesToDispose = [];
        const materialsToDispose = [];
        const dolphins = [];
        const palmTrees = [];

        // --- Scene Construction ---

        // Ocean
        const oceanGeometry = new THREE.PlaneGeometry(3000, 3000, 100, 100);
        const oceanMaterial = new THREE.MeshStandardMaterial({
            color: 0x0891b2,
            roughness: 0.1,
            metalness: 0.8,
            transparent: true,
            opacity: 0.85
        });
        const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
        ocean.rotation.x = -Math.PI / 2;
        ocean.position.y = -4; // Just below the lowest island level
        ocean.receiveShadow = true;
        scene.add(ocean);

        const oceanVertices = oceanGeometry.attributes.position;
        const originalPositions = [];
        for (let i = 0; i < oceanVertices.count; i++) {
            originalPositions.push(oceanVertices.getZ(i));
        }

        // --- Recursive Render of Hierarchy ---

        const renderNode = (node) => {
            const x = node.x;
            const z = node.y; // D3 y maps to 3D z
            const r = node.r;

            // Height scaling: Deeper = Higher
            // Base height + depth * step
            const platformHeight = 3;
            const y = (node.depth * platformHeight);

            if (node.children) {
                // Directories -> Platforms

                // Truncated cone for island/terrace look
                // Top radius = r, Bottom radius = r + margin
                const geometry = new THREE.CylinderGeometry(r, r + 2, platformHeight, 64);

                const color = getDirectoryColor(node.depth);

                const material = new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: 0.9,
                    metalness: 0.1
                });

                const mesh = new THREE.Mesh(geometry, material);
                // Center Y of cylinder
                mesh.position.set(x, y - (platformHeight / 2), z);
                mesh.receiveShadow = true;
                mesh.castShadow = true;

                mesh.userData = {
                    type: 'directory',
                    name: node.data.name,
                    depth: node.depth,
                    path: node.ancestors().map(n => n.data.name).reverse().join('/')
                };

                scene.add(mesh);
                interactableMeshes.push(mesh);
                geometriesToDispose.push(geometry);
                materialsToDispose.push(material);

                // Add border ring for definition
                const ringGeo = new THREE.TorusGeometry(r + 0.2, 0.3, 8, 64);
                const ringMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.1 });
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.rotation.x = Math.PI / 2;
                ring.position.set(x, y, z);
                scene.add(ring);
                geometriesToDispose.push(ringGeo);
                materialsToDispose.push(ringMat);

                // Add Palm Trees to the root island (shoreline)
                if (node.depth === 0) {
                    const numTrees = Math.floor(r / 5);
                    for (let i = 0; i < numTrees; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const treeR = r - 2 - Math.random() * 5;
                        const treeX = x + Math.cos(angle) * treeR;
                        const treeZ = z + Math.sin(angle) * treeR;

                        // Simple Palm Tree
                        const trunkH = 4 + Math.random() * 2;
                        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, trunkH, 8);
                        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
                        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                        trunk.position.set(treeX, y + trunkH / 2, treeZ);
                        scene.add(trunk);
                        palmTrees.push(trunk);
                        geometriesToDispose.push(trunkGeo);
                        materialsToDispose.push(trunkMat);

                        const leafGeo = new THREE.ConeGeometry(1.5, 3, 5);
                        const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e });
                        const foliage = new THREE.Mesh(leafGeo, leafMat);
                        foliage.position.set(treeX, y + trunkH + 1, treeZ);
                        scene.add(foliage);
                        geometriesToDispose.push(leafGeo);
                        materialsToDispose.push(leafMat);
                    }
                }

                // Recurse
                node.children.forEach(renderNode);

            } else {
                // Files -> Towers
                const complexity = node.data.avgComplexity || 1;
                const towerHeight = 10 + (complexity * 5); // Taller towers

                // Radius slightly smaller than allocated circle
                const towerRadius = Math.max(0.5, r * 0.8);

                const geometry = new THREE.CylinderGeometry(towerRadius, towerRadius, towerHeight, 32);
                const color = getComplexityColor(complexity);
                const material = new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: 0.3,
                    metalness: 0.6
                });

                const mesh = new THREE.Mesh(geometry, material);

                // Parent surface Y is (depth-1)*platformHeight (which is top of parent platform)
                // Actually parent top is at `(node.depth - 1) * platformHeight`.
                // Let's verify: 
                // parent depth d-1. mesh y pos = (d-1)*h - h/2. Top = (d-1)*h. Correct.

                const parentTopY = (node.depth - 1) * platformHeight;
                mesh.position.set(x, parentTopY + towerHeight / 2, z);

                mesh.castShadow = true;
                mesh.receiveShadow = true;

                mesh.userData = {
                    type: 'file',
                    name: node.data.name,
                    ...node.data.fileData,
                    avgComplexity: complexity.toFixed(2),
                    totalLoc: node.data.totalLoc,
                    numFunctions: node.data.numFunctions
                };

                scene.add(mesh);
                interactableMeshes.push(mesh);
                geometriesToDispose.push(geometry);
                materialsToDispose.push(material);

                // Cap
                const capGeo = new THREE.CylinderGeometry(towerRadius, towerRadius, 0.2, 32);
                const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 0.4 });
                const cap = new THREE.Mesh(capGeo, capMat);
                cap.position.set(x, parentTopY + towerHeight + 0.1, z);
                scene.add(cap);
                geometriesToDispose.push(capGeo);
                materialsToDispose.push(capMat);
            }
        };

        if (individualFiles.length > 0) {
            renderNode(root);
        }

        // --- Decorations ---
        // Add dolphins roaming
        for (let i = 0; i < 4; i++) {
            const dolphinGroup = new THREE.Group();
            const bodyGeometry = new THREE.SphereGeometry(1.5, 16, 12);
            const dolphinMaterial = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.4, roughness: 0.5 });
            const body = new THREE.Mesh(bodyGeometry, dolphinMaterial);
            body.scale.set(1, 0.5, 2);
            dolphinGroup.add(body);

            // Fin
            const finGeo = new THREE.ConeGeometry(0.5, 1, 4);
            const fin = new THREE.Mesh(finGeo, dolphinMaterial);
            fin.position.set(0, 0.8, 0.5);
            fin.rotation.x = -0.5;
            dolphinGroup.add(fin);
            geometriesToDispose.push(finGeo);

            const radius = 350 + Math.random() * 100;
            const angle = (i / 4) * Math.PI * 2;

            dolphinGroup.position.set(islandCenterX + Math.cos(angle) * radius, -3, islandCenterZ + Math.sin(angle) * radius);
            scene.add(dolphinGroup);
            dolphins.push({ group: dolphinGroup, angle, radius, phase: Math.random() * Math.PI });

            geometriesToDispose.push(bodyGeometry);
            materialsToDispose.push(dolphinMaterial);
        }

        // --- Controls & interaction ---
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        // Keyboard controls
        const handleKeyDown = (e) => keysRef.current[e.key.toLowerCase()] = true;
        const handleKeyUp = (e) => keysRef.current[e.key.toLowerCase()] = false;
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        let isMouseLocked = false;
        let yaw = 0;
        let pitch = -0.6; // Look down 

        // Animation Loop
        let time = 0;
        const animate = () => {
            animationIdRef.current = requestAnimationFrame(animate);
            time += 0.01;

            // Ocean animation
            for (let i = 0; i < oceanVertices.count; i++) {
                const z = originalPositions[i];
                const x = oceanVertices.getX(i);
                const y = oceanVertices.getY(i);
                const wave = Math.sin(x * 0.03 + time) * 1.0 + Math.cos(y * 0.03 + time * 0.8) * 1.0;
                oceanVertices.setZ(i, z + wave);
            }
            oceanVertices.needsUpdate = true;

            // Dolphins
            dolphins.forEach(d => {
                d.angle += 0.003;
                d.group.position.x = islandCenterX + Math.cos(d.angle) * d.radius;
                d.group.position.z = islandCenterZ + Math.sin(d.angle) * d.radius;
                d.group.rotation.y = -d.angle;

                // Jump
                const jump = Math.sin(time * 1.5 + d.phase) * 6;
                d.group.position.y = -4 + Math.max(0, jump);
                d.group.rotation.x = jump > 1 ? -0.5 : 0;
            });

            // Camera Movement
            const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
            camera.quaternion.setFromEuler(euler);

            const keys = keysRef.current;
            const moveVec = new THREE.Vector3();
            if (keys['w']) moveVec.z -= moveSpeed * 2;
            if (keys['s']) moveVec.z += moveSpeed * 2;
            if (keys['a']) moveVec.x -= moveSpeed * 2;
            if (keys['d']) moveVec.x += moveSpeed * 2;
            if (keys['q']) moveVec.y += moveSpeed * 2;
            if (keys['e']) moveVec.y -= moveSpeed * 2;

            if (moveVec.length() > 0) {
                moveVec.applyQuaternion(camera.quaternion);
                camera.position.add(moveVec);
            }

            renderer.render(scene, camera);
        };
        animate();

        const onMouseClick = (event) => {
            if (!mountRef.current) return;
            const rect = mountRef.current.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(interactableMeshes);

            if (intersects.length > 0 && !isMouseLocked) {
                const obj = intersects[0].object;
                if (obj.userData.type === 'file' && onFunctionClick) {
                    onFunctionClick(obj.userData);
                }
            } else {
                if (!isMouseLocked) mountRef.current.requestPointerLock();
                else document.exitPointerLock();
            }
        };

        const onPointerLockChange = () => {
            isMouseLocked = document.pointerLockElement === mountRef.current;
        };

        const onMouseMove = (event) => {
            if (!mountRef.current) return;

            if (!isMouseLocked) {
                // Hover logic
                const rect = mountRef.current.getBoundingClientRect();
                mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                setHoverInfoPosition({ x: event.clientX + 15, y: event.clientY });

                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(interactableMeshes);

                // Reset emissions
                interactableMeshes.forEach(m => {
                    if (m.material.emissive) m.material.emissiveIntensity = 0.4; // cap default
                    else if (m.userData.type === 'directory') m.material.emissiveIntensity = 0;
                });

                if (intersects.length > 0) {
                    const obj = intersects[0].object;
                    setHoveredObject(obj.userData);

                    // Highlight
                    const mat = obj.material;
                    if (mat) {
                        // Creating a clone might be expensive per frame, but ok for hover
                        // Actually better to just modify prop.
                        // Standard material has emissive.
                        if (obj.userData.type === 'file') {
                            mat.emissiveIntensity = 0.8;
                        }
                    }
                } else {
                    setHoveredObject(null);
                }

            } else {
                // Look logic
                yaw -= event.movementX * 0.002;
                pitch -= event.movementY * 0.002;
                pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
            }
        };

        document.addEventListener('pointerlockchange', onPointerLockChange);
        mountRef.current.addEventListener('click', onMouseClick);
        mountRef.current.addEventListener('mousemove', onMouseMove);

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
            document.removeEventListener('pointerlockchange', onPointerLockChange);

            if (mountRef.current) {
                mountRef.current.removeEventListener('click', onMouseClick);
                mountRef.current.removeEventListener('mousemove', onMouseMove);
                if (renderer.domElement && mountRef.current.contains(renderer.domElement)) {
                    mountRef.current.removeChild(renderer.domElement);
                }
            }

            // Disposal
            geometriesToDispose.forEach(g => g.dispose());
            materialsToDispose.forEach(m => m.dispose());
            oceanGeometry.dispose();
            oceanMaterial.dispose();
            renderer.dispose();
        };

    }, [individualFiles, onFunctionClick, minComplexity, maxComplexity]);

    return (
        <div className="relative w-full h-full">
            <div ref={mountRef} className="w-full h-full" style={{ minHeight: '55vh' }} />

            {/* Tooltip */}
            {hoveredObject && (
                <div
                    className="fixed z-50 pointer-events-none"
                    style={{
                        left: `${hoverInfoPosition.x}px`,
                        top: `${hoverInfoPosition.y}px`,
                        transform: 'translateY(-50%)'
                    }}
                >
                    <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-4 border border-gray-200/50">
                        <div className="flex items-center gap-2 mb-2">
                            {hoveredObject.type === 'file' ? (
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `#${getComplexityColor(parseFloat(hoveredObject.avgComplexity)).toString(16).padStart(6, '0')}` }} />
                            ) : (
                                <div className="w-3 h-3 rounded-sm bg-amber-200" />
                            )}
                            <span className="font-bold text-gray-900">{hoveredObject.name}</span>
                        </div>
                        {hoveredObject.type === 'file' && (
                            <div className="space-y-1 text-sm text-gray-600">
                                <div className="flex justify-between gap-4">
                                    <span>Avg. Complexity:</span>
                                    <span className="font-medium text-gray-900">{hoveredObject.avgComplexity}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span>LOC:</span>
                                    <span className="font-medium text-gray-900">{hoveredObject.totalLoc}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span>Functions:</span>
                                    <span className="font-medium text-gray-900">{hoveredObject.numFunctions}</span>
                                </div>
                            </div>
                        )}
                        {hoveredObject.type === 'directory' && (
                            <div className="text-xs text-gray-500 italic max-w-[200px] break-all">
                                {hoveredObject.path}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Controls Help */}
            <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-md rounded-xl shadow-lg p-4 z-10 border border-white/50">
                <h4 className="font-bold text-sm mb-2 text-gray-800 flex items-center gap-2">
                    <span className="text-base">🎮</span> Controls
                </h4>
                <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">WASD</kbd><span>Move</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Click</kbd><span>Capture Mouse</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">ESC</kbd><span>Release Mouse</span>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-md rounded-xl shadow-lg p-4 z-10 border border-white/50">
                <h4 className="font-bold text-sm mb-3 text-gray-800 flex items-center gap-2">
                    <span className="text-base">🏝️</span> Terraced Map
                </h4>
                <div className="space-y-2 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-[#f5d5a8] rounded-sm" />
                        <span>Platform = Directory</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-3 bg-emerald-500 rounded-sm mx-1" />
                        <span>Tower = File</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 rounded-full w-16" />
                        <span>Complexity</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Island3DVisualization;
