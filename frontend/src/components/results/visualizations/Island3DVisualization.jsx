import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as d3 from 'd3';
import gsap from 'gsap';
import { Settings } from 'lucide-react';
import FunctionMoleculeVisualization from './FunctionMoleculeVisualization';
import { SceneDiffer } from '../../../utils/SceneDiffer';

function Island3DVisualization({ individualFiles, onFunctionClick, onFileClick, isDarkMode }) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const animationIdRef = useRef(null);
    const cameraRef = useRef(null);

    const [hoveredObject, setHoveredObject] = useState(null);
    const [hoverInfoPosition, setHoverInfoPosition] = useState({ x: 0, y: 0 });

    // New Interaction State
    const [viewMode, setViewMode] = useState('island'); // 'island' | 'functions'
    const [focusedFile, setFocusedFile] = useState(null);
    const [menuPosition, setMenuPosition] = useState(null); // { x, y }
    const [activeFileForMenu, setActiveFileForMenu] = useState(null);

    // Visualization Options
    const [towerOpacity, setTowerOpacity] = useState(1.0); // 0.0 to 1.0
    const [showDecorations, setShowDecorations] = useState(false);
    const [showOptionsPanel, setShowOptionsPanel] = useState(false);

    const keysRef = useRef({});
    const moveSpeed = 0.5;

    // Persist Camera Orientation
    const yawRef = useRef(0);
    const pitchRef = useRef(-0.6); // Look down

    // Incremental Update Tracking
    const previousFilesRef = useRef(null);
    const buildingMeshesRef = useRef(new Map()); // filename -> { mesh, cap, data }
    const directoryMeshesRef = useRef(new Map()); // path -> { mesh, ring }
    const sceneInitializedRef = useRef(false);

    if (!individualFiles || individualFiles.length === 0) {
        return (
            <div className={`flex items-center justify-center h-full ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                No files to visualize
            </div>
        );
    }

    // --- Data Processing Helpers ---

    const calculateFileMetrics = (file) => {
        const totalLoc = file.total_nloc || file.total_loc || 1;
        const totalComplexity = file.total_complexity || 0;

        return { totalLoc, totalComplexity, numFunctions: (file.functions || []).length };
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
                        const { totalLoc, totalComplexity, numFunctions } = calculateFileMetrics(file);
                        existingNode = {
                            name: part,
                            type: 'file',
                            fileData: file,
                            value: totalLoc, // D3 pack uses 'value' for size
                            totalComplexity: totalComplexity,
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
        const { totalComplexity } = calculateFileMetrics(file);
        if (totalComplexity > 0) allComplexities.push(totalComplexity);
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
        if (isDarkMode) {
            // Dark Slate / Grey tones
            const colors = [
                0x1e293b, // Depth 0 (Root) - Dark Slate 800
                0x334155, // Depth 1 - Slate 700
                0x475569, // Depth 2 - Slate 600
                0x64748b, // Depth 3 - Slate 500
                0x94a3b8, // Depth 4 - Slate 400
            ];
            return colors[Math.min(depth, colors.length - 1)];
        }

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

    // --- Animation Helper Functions ---

    const animateBuildingHeight = (mesh, cap, targetHeight, currentHeight, duration = 0.5) => {
        const scale = targetHeight / currentHeight;

        gsap.to(mesh.scale, {
            y: scale,
            duration: duration,
            ease: "power2.inOut"
        });

        // Adjust position to keep bottom fixed
        const currentY = mesh.position.y;
        const targetY = currentY + (targetHeight - currentHeight) / 2;

        gsap.to(mesh.position, {
            y: targetY,
            duration: duration,
            ease: "power2.inOut"
        });

        // Move cap to new top
        if (cap) {
            gsap.to(cap.position, {
                y: cap.position.y + (targetHeight - currentHeight),
                duration: duration,
                ease: "power2.inOut"
            });
        }
    };

    const animateBuildingColor = (mesh, cap, targetColor, duration = 0.5) => {
        const r = ((targetColor >> 16) & 255) / 255;
        const g = ((targetColor >> 8) & 255) / 255;
        const b = (targetColor & 255) / 255;

        gsap.to(mesh.material.color, {
            r, g, b,
            duration: duration,
            ease: "power2.inOut"
        });

        if (mesh.material.emissive) {
            gsap.to(mesh.material.emissive, {
                r, g, b,
                duration: duration,
                ease: "power2.inOut"
            });
        }

        if (cap && cap.material.emissive) {
            gsap.to(cap.material.emissive, {
                r, g, b,
                duration: duration,
                ease: "power2.inOut"
            });
        }
    };

    const animateBuildingFadeIn = (mesh, cap, duration = 0.5) => {
        mesh.material.transparent = true;
        mesh.material.opacity = 0;
        mesh.visible = true;

        if (cap) {
            cap.material.transparent = true;
            cap.material.opacity = 0;
            cap.visible = true;
        }

        gsap.to(mesh.material, {
            opacity: towerOpacity,
            duration: duration,
            ease: "power2.inOut",
            onComplete: () => {
                if (towerOpacity >= 1.0) {
                    mesh.material.transparent = false;
                }
            }
        });

        if (cap) {
            gsap.to(cap.material, {
                opacity: towerOpacity,
                duration: duration,
                ease: "power2.inOut",
                onComplete: () => {
                    if (towerOpacity >= 1.0) {
                        cap.material.transparent = false;
                    }
                }
            });
        }
    };

    const animateBuildingFadeOut = (mesh, cap, duration = 0.5, onComplete) => {
        mesh.material.transparent = true;
        if (cap) cap.material.transparent = true;

        gsap.to(mesh.material, {
            opacity: 0,
            duration: duration,
            ease: "power2.inOut"
        });

        if (cap) {
            gsap.to(cap.material, {
                opacity: 0,
                duration: duration,
                ease: "power2.inOut",
                onComplete: () => {
                    mesh.visible = false;
                    cap.visible = false;
                    onComplete?.();
                }
            });
        } else {
            gsap.to(mesh.material, {
                opacity: 0,
                duration: duration,
                ease: "power2.inOut",
                onComplete: () => {
                    mesh.visible = false;
                    onComplete?.();
                }
            });
        }
    };

    useEffect(() => {
        if (!mountRef.current) return;

        // --- Incremental Update Path ---
        // If scene is already initialized and we have previous files, do incremental update
        if (sceneInitializedRef.current && previousFilesRef.current && sceneRef.current) {
            const diff = SceneDiffer.diffFiles(previousFilesRef.current, individualFiles);
            console.log('[Island3D] Incremental update:', SceneDiffer.getSummary(diff));

            // Handle removed files
            diff.removed.forEach(file => {
                const buildingData = buildingMeshesRef.current.get(file.filename);
                if (buildingData) {
                    animateBuildingFadeOut(buildingData.mesh, buildingData.cap, 0.3, () => {
                        sceneRef.current.remove(buildingData.mesh);
                        sceneRef.current.remove(buildingData.cap);
                        buildingData.mesh.geometry.dispose();
                        buildingData.mesh.material.dispose();
                        buildingData.cap.geometry.dispose();
                        buildingData.cap.material.dispose();
                        buildingMeshesRef.current.delete(file.filename);
                    });
                }
            });

            // Handle modified files
            diff.modified.forEach(({ old: oldFile, new: newFile, filename }) => {
                const buildingData = buildingMeshesRef.current.get(filename);
                if (buildingData) {
                    const oldMetrics = calculateFileMetrics(oldFile);
                    const newMetrics = calculateFileMetrics(newFile);

                    // Animate height change if LOC changed
                    if (oldMetrics.totalLoc !== newMetrics.totalLoc) {
                        const oldHeight = 10 + (Math.sqrt(oldMetrics.totalComplexity || 1) * 15);
                        const newHeight = 10 + (Math.sqrt(newMetrics.totalComplexity || 1) * 15);
                        animateBuildingHeight(buildingData.mesh, buildingData.cap, newHeight, oldHeight, 0.5);
                    }

                    // Animate color change if complexity changed
                    if (oldMetrics.totalComplexity !== newMetrics.totalComplexity) {
                        const isUnsupported = newFile.is_unsupported;
                        const newColor = isUnsupported
                            ? (isDarkMode ? 0xcfcfcf : 0x9ca3af)
                            : getComplexityColor(newMetrics.totalComplexity);
                        animateBuildingColor(buildingData.mesh, buildingData.cap, newColor, 0.5);
                    }

                    // Update stored data
                    buildingData.data = newFile;
                    buildingData.mesh.userData = {
                        type: 'file',
                        name: newFile.filename.split('/').pop(),
                        ...newFile,
                        totalComplexity: newMetrics.totalComplexity.toFixed(2),
                        totalLoc: newMetrics.totalLoc,
                        numFunctions: newMetrics.numFunctions
                    };
                }
            });

            // For added files, we need to do a full rebuild to recalculate layout
            // This is because D3 pack layout needs all files to calculate positions
            if (diff.added.length > 0) {
                console.log('[Island3D] New files added, doing full rebuild for layout recalculation');
                sceneInitializedRef.current = false; // Force full rebuild
                buildingMeshesRef.current.clear();
                directoryMeshesRef.current.clear();
            } else {
                // No new files, incremental update complete
                previousFilesRef.current = individualFiles;
                return;
            }
        }

        // --- Full Scene Rebuild Path ---
        // This runs on first load or when layout needs recalculation (new files added)
        console.log('[Island3D] Full scene rebuild');

        // --- Layout Calculation with D3 ---
        const hierarchyData = buildHierarchy(individualFiles);
        const root = d3.hierarchy(hierarchyData)
            .sum(d => d.value ? d.value : 0) // Sizing files by LOC (D3 pack uses value for area)
            .sort((a, b) => b.value - a.value);

        // Pack the circles
        const packLayout = d3.pack()
            .size([400, 400]) // Arbitrary large workspace size
            .padding(d => d.depth === 0 ? 30 : 20);

        packLayout(root);

        // --- Three.js Setup ---

        // Store pointer lock state before cleanup
        const wasPointerLocked = document.pointerLockElement === mountRef.current;

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
        if (isDarkMode) {
            gradient.addColorStop(0, '#020617'); // Dark Midnight
            gradient.addColorStop(1, '#1e293b'); // Dark Slate
            // scene.fog = new THREE.Fog(0x0f172a, 200, 900);
        } else {
            gradient.addColorStop(0, '#0ea5e9'); // Sky blue
            gradient.addColorStop(1, '#e0f2fe'); // Horizon
            // scene.fog = new THREE.Fog(0x7dd3fc, 200, 2000);
        }
        context.fillStyle = gradient;
        context.fillRect(0, 0, 2, 512);
        scene.background = new THREE.CanvasTexture(canvas);

        // Camera
        const camera = new THREE.PerspectiveCamera(55, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 2000);

        // Center camera roughly
        const islandCenterX = 200;
        const islandCenterZ = 200;

        // Initial position
        if (cameraRef.current) {
            // Restore previous position
            camera.position.copy(cameraRef.current.position);
            camera.quaternion.copy(cameraRef.current.quaternion);
        } else {
            camera.position.set(islandCenterX, 200, islandCenterZ + 300);
            camera.lookAt(islandCenterX, 0, islandCenterZ);
        }
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        mountRef.current.appendChild(renderer.domElement);

        // Restore pointer lock if it was active before rebuild
        if (wasPointerLocked) {
            // Use setTimeout to ensure DOM is ready
            setTimeout(() => {
                if (mountRef.current) {
                    mountRef.current.requestPointerLock();
                }
            }, 100);
        }

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, isDarkMode ? 0.3 : 0.6);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(isDarkMode ? 0xa5b4fc : 0xfff5e6, isDarkMode ? 0.8 : 1.5); // Moon/Sun
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
        const hemiLight = new THREE.HemisphereLight(
            isDarkMode ? 0x0f172a : 0x87CEEB,
            isDarkMode ? 0x334155 : 0x98FB98,
            isDarkMode ? 0.4 : 0.4
        );
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
            color: isDarkMode ? 0x1e1b4b : 0x0891b2, // Deep Indigo vs Cyan
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
                    roughness: isDarkMode ? 0.6 : 0.9,
                    metalness: isDarkMode ? 0.3 : 0.1,
                    emissive: color,
                    emissiveIntensity: 0
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
                const ringMat = new THREE.MeshStandardMaterial({
                    color: isDarkMode ? 0x38bdf8 : 0xffffff,
                    transparent: true,
                    opacity: isDarkMode ? 0.4 : 0.1,
                    emissive: isDarkMode ? 0x0ea5e9 : 0x000000,
                    emissiveIntensity: isDarkMode ? 0.5 : 0
                });
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.rotation.x = Math.PI / 2;
                ring.position.set(x, y, z);
                scene.add(ring);
                geometriesToDispose.push(ringGeo);
                materialsToDispose.push(ringMat);

                // Add Palm Trees to the root island (shoreline)
                if (node.depth === 0 && showDecorations) {
                    const numTrees = Math.floor(r / 5);
                    for (let i = 0; i < numTrees; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const treeR = r - 2 - Math.random() * 5;
                        const treeX = x + Math.cos(angle) * treeR;
                        const treeZ = z + Math.sin(angle) * treeR;

                        // Simple Palm Tree
                        const trunkH = 4 + Math.random() * 2;
                        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, trunkH, 8);
                        const trunkMat = new THREE.MeshStandardMaterial({ color: isDarkMode ? 0x57534e : 0x8b5a2b });
                        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                        trunk.position.set(treeX, y + trunkH / 2, treeZ);
                        scene.add(trunk);
                        palmTrees.push(trunk);
                        geometriesToDispose.push(trunkGeo);
                        materialsToDispose.push(trunkMat);

                        const leafGeo = new THREE.ConeGeometry(1.5, 3, 5);
                        const leafMat = new THREE.MeshStandardMaterial({
                            color: isDarkMode ? 0x15803d : 0x22c55e,
                            emissive: isDarkMode ? 0x22c55e : 0x000000,
                            emissiveIntensity: isDarkMode ? 0.2 : 0
                        });
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
                const complexity = node.data.totalComplexity || 1;
                const towerHeight = 10 + (Math.sqrt(complexity) * 15); // Square root scaling for height

                // Radius smaller than allocated circle to provide breathing room
                const towerRadius = 1.8 + (r * 0.9);

                const geometry = new THREE.CylinderGeometry(towerRadius, towerRadius, towerHeight, 32);
                const isUnsupported = node.data.fileData?.is_unsupported;
                const color = isUnsupported
                    ? (isDarkMode ? 0xcfcfcf : 0x9ca3af) // White in dark mode, Gray for unsupported
                    : getComplexityColor(complexity);
                const material = new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: 0.3,
                    metalness: 0.6,
                    emissive: color,
                    emissiveIntensity: isDarkMode ? 0.6 : 0,
                    transparent: towerOpacity < 1.0,
                    opacity: towerOpacity
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
                    totalComplexity: complexity.toFixed(2),
                    totalLoc: node.data.totalLoc,
                    numFunctions: node.data.numFunctions
                };

                scene.add(mesh);
                interactableMeshes.push(mesh);
                geometriesToDispose.push(geometry);
                materialsToDispose.push(material);

                // Cap
                const capGeo = new THREE.CylinderGeometry(towerRadius, towerRadius, 0.2, 32);
                const capMat = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    emissive: color,
                    emissiveIntensity: isDarkMode ? 0.9 : 0.4,
                    transparent: towerOpacity < 1.0,
                    opacity: towerOpacity
                });
                const cap = new THREE.Mesh(capGeo, capMat);
                cap.position.set(x, parentTopY + towerHeight + 0.1, z);
                scene.add(cap);
                geometriesToDispose.push(capGeo);
                materialsToDispose.push(capMat);

                // Store building reference for incremental updates
                buildingMeshesRef.current.set(node.data.fileData.filename, {
                    mesh,
                    cap,
                    data: node.data.fileData,
                    height: towerHeight
                });

                // Fade in new buildings if this is an incremental update
                if (sceneInitializedRef.current) {
                    animateBuildingFadeIn(mesh, cap, 0.5);
                }
            }
        };

        if (viewMode === 'island') {
            if (individualFiles.length > 0) {
                renderNode(root);
            }

            // --- Decorations (Only for Island) ---
            if (showDecorations) {
                // Add dolphins roaming
                for (let i = 0; i < 4; i++) {
                    const dolphinGroup = new THREE.Group();
                    const bodyGeometry = new THREE.SphereGeometry(1.5, 16, 12);
                    const dolphinMaterial = new THREE.MeshStandardMaterial({
                        color: isDarkMode ? 0x94a3b8 : 0x64748b,
                        metalness: 0.4,
                        roughness: 0.5
                    });
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
            }
        } else if (viewMode === 'functions' && focusedFile) {
            // --- Function Visualization (Satellites) ---

            // Central Core (File)
            const coreRadius = 20;
            const coreGeo = new THREE.SphereGeometry(coreRadius, 64, 64);
            const coreColor = getComplexityColor(focusedFile.totalComplexity);
            const coreMat = new THREE.MeshStandardMaterial({
                color: coreColor,
                roughness: 0.2,
                metalness: 0.8,
                emissive: coreColor,
                emissiveIntensity: isDarkMode ? 0.5 : 0.2
            });
            const core = new THREE.Mesh(coreGeo, coreMat);
            core.position.set(islandCenterX, 50, islandCenterZ);
            scene.add(core);
            geometriesToDispose.push(coreGeo);
            materialsToDispose.push(coreMat);

            // Orbiting Functions
            const functionData = focusedFile.functions || [];
            const orbitRadiusBase = 40;

            functionData.forEach((fn, index) => {
                const layer = Math.floor(index / 8) + 1;
                const radius = orbitRadiusBase + (layer * 15);
                const angle = (index % 8) * (Math.PI * 2 / 8) + (layer * 0.5);

                const size = Math.max(2, Math.min(8, Math.sqrt(fn.nloc || 1)));
                const fnGeo = new THREE.SphereGeometry(size, 32, 32);
                const fnColor = getComplexityColor(fn.cyclomatic_complexity);
                const fnMat = new THREE.MeshStandardMaterial({
                    color: fnColor,
                    roughness: 0.3,
                    metalness: 0.5,
                    emissive: fnColor,
                    emissiveIntensity: isDarkMode ? 0.8 : 0.4
                });

                const satellite = new THREE.Mesh(fnGeo, fnMat);

                // Initial position (will be animated)
                satellite.position.set(
                    islandCenterX + Math.cos(angle) * radius,
                    50 + (Math.random() - 0.5) * 10,
                    islandCenterZ + Math.sin(angle) * radius
                );

                satellite.userData = {
                    type: 'function',
                    name: fn.name,
                    nloc: fn.nloc,
                    complexity: fn.cyclomatic_complexity,
                    fileData: focusedFile
                };

                scene.add(satellite);
                interactableMeshes.push(satellite);
                geometriesToDispose.push(fnGeo);
                materialsToDispose.push(fnMat);

                // Orbit visual ring
                const orbitGeo = new THREE.TorusGeometry(radius, 0.1, 16, 100);
                const orbitMat = new THREE.MeshBasicMaterial({
                    color: isDarkMode ? 0x475569 : 0xcbcbcb,
                    transparent: true,
                    opacity: 0.3
                });
                const orbit = new THREE.Mesh(orbitGeo, orbitMat);
                orbit.position.set(islandCenterX, 50, islandCenterZ);
                orbit.rotation.x = Math.PI / 2;
                scene.add(orbit);
                geometriesToDispose.push(orbitGeo);
                materialsToDispose.push(orbitMat);

                // Store for animation
                dolphins.push({ // Reusing dolphins array for generic animatables
                    mesh: satellite,
                    radius: radius,
                    angle: angle,
                    speed: 0.005 + (Math.random() * 0.005) * (layer % 2 === 0 ? 1 : -1),
                    y: satellite.position.y
                });
            });

            // Adjust Camera focus
            camera.position.set(islandCenterX, 150, islandCenterZ + 150);
            camera.lookAt(islandCenterX, 50, islandCenterZ);
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

            // Dolphins / Satellites Animation
            dolphins.forEach(d => {
                if (viewMode === 'island') {
                    d.angle += 0.003;
                    d.group.position.x = islandCenterX + Math.cos(d.angle) * d.radius;
                    d.group.position.z = islandCenterZ + Math.sin(d.angle) * d.radius;
                    d.group.rotation.y = -d.angle;

                    // Jump
                    const jump = Math.sin(time * 1.5 + d.phase) * 6;
                    d.group.position.y = -4 + Math.max(0, jump);
                    d.group.rotation.x = jump > 1 ? -0.5 : 0;
                } else {
                    // Satellites
                    d.angle += d.speed;
                    d.mesh.position.x = islandCenterX + Math.cos(d.angle) * d.radius;
                    d.mesh.position.z = islandCenterZ + Math.sin(d.angle) * d.radius;
                }
            });

            // Camera Movement
            const euler = new THREE.Euler(pitchRef.current, yawRef.current, 0, 'YXZ');
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

            // Determine raycast coordinates based on lock state
            if (isMouseLocked) {
                // If locked, raycast from center of screen
                mouse.x = 0;
                mouse.y = 0;
            } else {
                // If unlocked, use mouse coordinates
                const rect = mountRef.current.getBoundingClientRect();
                mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            }

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(interactableMeshes);

            if (intersects.length > 0) {
                const obj = intersects[0].object;

                if (viewMode === 'island') {
                    if (obj.userData.type === 'file') {
                        // Open Context Menu
                        setActiveFileForMenu(obj.userData);

                        // Interaction handling:
                        // If locked, we MUST unlock to let the user use the menu.
                        // We also place the menu in the center of the screen since that's where they were looking.
                        if (isMouseLocked) {
                            setMenuPosition({
                                x: window.innerWidth / 2,
                                y: window.innerHeight / 2
                            });
                            document.exitPointerLock();
                        } else {
                            // If unlocked, place menu at mouse cursor
                            setMenuPosition({
                                x: event.clientX,
                                y: event.clientY
                            });
                        }
                    }
                } else if (viewMode === 'functions') {
                    // Future interaction for function mode
                }
            } else {
                // If clicked on nothing:
                // If locked, do nothing (or remain locked)
                // If unlocked, and we clicked background, capture mouse
                if (!isMouseLocked) mountRef.current.requestPointerLock();
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
                    const defaultIntensity = isDarkMode
                        ? (m.userData.type === 'file' ? 0.6 : 0)
                        : 0; // Light mode default is 0

                    if (m.material.emissive) m.material.emissiveIntensity = defaultIntensity;
                });

                if (intersects.length > 0) {
                    const obj = intersects[0].object;
                    setHoveredObject(obj.userData);

                    // Highlight
                    const mat = obj.material;
                    if (mat) {
                        if (obj.userData.type === 'file' || obj.userData.type === 'function') {
                            mat.emissiveIntensity = isDarkMode ? 1.0 : 0.6; // Glow in both modes
                        } else if (obj.userData.type === 'directory') {
                            mat.emissiveIntensity = isDarkMode ? 0.4 : 0.2; // Subtle glow for base
                        }
                    }
                } else {
                    setHoveredObject(null);
                }

            } else {
                // Look logic
                yawRef.current -= event.movementX * 0.002;
                pitchRef.current -= event.movementY * 0.002;
                pitchRef.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitchRef.current));
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

        // Mark scene as initialized for future incremental updates
        sceneInitializedRef.current = true;
        previousFilesRef.current = individualFiles;

    }, [individualFiles, onFunctionClick, minComplexity, maxComplexity, isDarkMode, viewMode, focusedFile, towerOpacity, showDecorations]);

    const handleMenuAction = (action) => {
        if (!activeFileForMenu) return;

        if (action === 'code') {
            if (onFileClick) onFileClick(activeFileForMenu);
        } else if (action === 'functions') {
            setFocusedFile(activeFileForMenu);
            setViewMode('functions');
        }
        setMenuPosition(null);
        setActiveFileForMenu(null);
    };

    // If in functions mode, render the separate component
    if (viewMode === 'functions' && focusedFile) {
        return (
            <FunctionMoleculeVisualization
                file={focusedFile}
                isDarkMode={isDarkMode}
                onFunctionClick={onFunctionClick}
                onBack={() => {
                    setViewMode('island');
                    setFocusedFile(null);
                }}
            />
        );
    }

    return (
        <div className="relative w-full h-full">
            <div ref={mountRef} className="w-full h-full" style={{ minHeight: '55vh' }} />

            {/* Back Button (Functions Mode) */}
            {viewMode === 'functions' && (
                <div className="absolute top-20 left-6 z-50">
                    <button
                        onClick={() => {
                            setViewMode('island');
                            setFocusedFile(null);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-xl shadow-lg hover:scale-105 transition-all border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-gray-100 font-bold"
                    >
                        <span>← Back to Island</span>
                    </button>
                    {focusedFile && (
                        <div className="mt-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                            <h2 className="text-xl font-black bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent transform scale-x-0 transition-transform origin-left animate-in fill-mode-forwards duration-500 ease-out" style={{ opacity: 1, transform: 'scaleX(1)' }}>
                                {focusedFile.name}
                            </h2>
                            <div className="flex gap-4 mt-2 text-sm text-gray-600 dark:text-gray-300">
                                <span>Functions: <b>{focusedFile.numFunctions}</b></span>
                                <span>LLOC: <b>{focusedFile.totalLoc}</b></span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Context Menu */}
            {menuPosition && activeFileForMenu && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-[59]"
                        onClick={() => {
                            setMenuPosition(null);
                            setActiveFileForMenu(null);
                        }}
                    />

                    {/* Menu */}
                    <div
                        className="fixed z-[60] min-w-[160px] bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                        style={{
                            left: `${menuPosition.x}px`,
                            top: `${menuPosition.y}px`
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{activeFileForMenu.name}</span>
                        </div>
                        <button
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200"
                            onClick={() => handleMenuAction('code')}
                        >
                            <span>View Code</span>
                        </button>
                        {!activeFileForMenu.is_unsupported && (
                            <button
                                className="w-full text-left px-4 py-3 hover:bg-purple-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200"
                                onClick={() => handleMenuAction('functions')}
                            >
                                <span>View Functions</span>
                            </button>
                        )}
                    </div>
                </>
            )}

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
                            {hoveredObject.type === 'file' || hoveredObject.type === 'function' ? (
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `#${getComplexityColor(parseFloat(hoveredObject.complexity || hoveredObject.totalComplexity)).toString(16).padStart(6, '0')}` }} />
                            ) : (
                                <div className="w-3 h-3 rounded-sm bg-amber-200" />
                            )}
                            <span className="font-bold text-gray-900">{hoveredObject.name}</span>
                        </div>
                        {hoveredObject.type === 'file' && (
                            <div className="space-y-1 text-sm text-gray-600">
                                {hoveredObject.is_unsupported ? (
                                    <div className="flex justify-between gap-4">
                                        <span>LLOC:</span>
                                        <span className="font-medium text-gray-900">{hoveredObject.totalLoc}</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between gap-4">
                                            <span>Total Complexity:</span>
                                            <span className="font-medium text-gray-900">{hoveredObject.totalComplexity}</span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <span>LLOC:</span>
                                            <span className="font-medium text-gray-900">{hoveredObject.totalLoc}</span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <span>Functions:</span>
                                            <span className="font-medium text-gray-900">{hoveredObject.numFunctions}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {hoveredObject.type === 'directory' && (
                            <div className="text-xs text-gray-500 italic max-w-[200px] break-all">
                                {hoveredObject.path}
                            </div>
                        )}
                        {hoveredObject.type === 'function' && (
                            <div className="space-y-1 text-sm text-gray-600">
                                <div className="flex justify-between gap-4">
                                    <span>Complexity:</span>
                                    <span className="font-medium text-gray-900">{hoveredObject.complexity}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span>LLOC:</span>
                                    <span className="font-medium text-gray-900">{hoveredObject.nloc}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Options Panel */}
            <div className="absolute top-6 left-6 z-10">
                <button
                    onClick={() => setShowOptionsPanel(!showOptionsPanel)}
                    className={`p-3 backdrop-blur-xl shadow-2xl rounded-2xl transition-all border ring-1 ring-white/10 ${isDarkMode
                        ? 'bg-black/20 hover:bg-black/30 border-white/10 text-gray-100'
                        : 'bg-white/10 hover:bg-white/20 border-white/20 text-gray-800'}`}
                    title="Visualization Options"
                >
                    <Settings size={22} strokeWidth={2.5} />
                </button>

                {showOptionsPanel && (
                    <div className={`mt-2 backdrop-blur-md rounded-xl shadow-lg p-4 border min-w-[250px] animate-in fade-in slide-in-from-top-2 ${isDarkMode
                        ? 'bg-slate-800/90 border-slate-700/50'
                        : 'bg-white/90 border-white/50'}`}>
                        <h4 className={`font-bold text-sm mb-3 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>Visualization Options</h4>

                        {/* Tower Opacity Slider */}
                        <div className="mb-4">
                            <label className={`text-xs mb-1 block ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                Tower Transparency: {Math.round((1 - towerOpacity) * 100)}%
                            </label>
                            <input
                                type="range"
                                min="0.6"
                                max="1"
                                step="0.1"
                                value={towerOpacity}
                                onChange={(e) => setTowerOpacity(parseFloat(e.target.value))}
                                className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500 ${isDarkMode ? 'bg-slate-700' : 'bg-gray-200'}`}
                            />
                            <div className={`flex justify-between text-[10px] mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                <span>Transparent</span>
                                <span>Opaque</span>
                            </div>
                        </div>

                        {/* Decorations Toggle */}
                        <div className="flex items-center justify-between">
                            <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Show Decorations</span>
                            <button
                                onClick={() => setShowDecorations(!showDecorations)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showDecorations
                                    ? 'bg-blue-500'
                                    : (isDarkMode ? 'bg-slate-600' : 'bg-gray-300')
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showDecorations ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                        <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {showDecorations ? 'Trees & dolphins visible' : 'Trees & dolphins hidden'}
                        </p>
                    </div>
                )}
            </div>

            {/* Controls Help */}
            <div className={`absolute bottom-4 left-4 backdrop-blur-md rounded-xl shadow-lg p-4 z-10 border ${isDarkMode
                ? 'bg-slate-800/80 border-slate-700/50'
                : 'bg-white/80 border-white/50'}`}>
                <h4 className={`font-bold text-sm mb-2 flex items-center gap-2 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                    Controls
                </h4>
                <div className={`space-y-1 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    <div className="flex items-center gap-2">
                        <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDarkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>WASD</kbd><span>Move</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDarkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>Click</kbd><span>Capture Mouse</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDarkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>ESC</kbd><span>Release Mouse</span>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className={`absolute bottom-4 right-4 backdrop-blur-md rounded-xl shadow-lg p-4 z-10 border ${isDarkMode
                ? 'bg-slate-800/80 border-slate-700/50'
                : 'bg-white/80 border-white/50'}`}>
                <h4 className={`font-bold text-sm mb-3 flex items-center gap-2 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                    Terraced Map
                </h4>
                <div className={`space-y-2 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
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
