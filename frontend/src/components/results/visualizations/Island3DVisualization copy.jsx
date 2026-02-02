import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

function Island3DVisualization({ individualFiles, onFunctionClick }) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const animationIdRef = useRef(null);
    const cameraRef = useRef(null);

    const [hoveredCylinder, setHoveredCylinder] = useState(null);
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

    // Group files by directory
    const groupFilesByDirectory = (files) => {
        const groups = {};
        files.forEach(file => {
            const filename = file.filename || '';
            const parts = filename.split('/');
            const directory = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
            if (!groups[directory]) {
                groups[directory] = [];
            }
            groups[directory].push(file);
        });
        return groups;
    };

    // Calculate file metrics
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

        return { totalLoc, avgComplexity };
    };

    const fileGroups = groupFilesByDirectory(individualFiles);
    const directories = Object.keys(fileGroups);

    // Calculate global min/max for scaling
    let allComplexities = [];
    let allLocs = [];
    individualFiles.forEach(file => {
        const { totalLoc, avgComplexity } = calculateFileMetrics(file);
        if (avgComplexity > 0) allComplexities.push(avgComplexity);
        allLocs.push(totalLoc);
    });

    const minComplexity = allComplexities.length > 0 ? Math.min(...allComplexities) : 1;
    const maxComplexity = allComplexities.length > 0 ? Math.max(...allComplexities) : 10;
    const maxLoc = Math.max(...allLocs, 1);

    const getComplexityColor = (complexity) => {
        if (complexity === undefined || complexity === null || complexity === 0) {
            return 0x6b7280; // Neutral gray
        }
        if (maxComplexity === minComplexity) {
            return 0x10b981; // Emerald green
        }
        const normalized = (complexity - minComplexity) / (maxComplexity - minComplexity);
        // Modern gradient: emerald green -> amber -> rose red
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

    // District color palette - modern, distinct colors
    const districtColors = [
        { ground: 0x3b82f6, accent: 0x60a5fa, name: 'Blue' },      // Blue district
        { ground: 0x8b5cf6, accent: 0xa78bfa, name: 'Purple' },    // Purple district
        { ground: 0x06b6d4, accent: 0x22d3ee, name: 'Cyan' },      // Cyan district
        { ground: 0xf59e0b, accent: 0xfbbf24, name: 'Amber' },     // Amber district
        { ground: 0xec4899, accent: 0xf472b6, name: 'Pink' },      // Pink district
        { ground: 0x14b8a6, accent: 0x2dd4bf, name: 'Teal' },      // Teal district
        { ground: 0xf97316, accent: 0xfb923c, name: 'Orange' },    // Orange district
        { ground: 0x84cc16, accent: 0xa3e635, name: 'Lime' },      // Lime district
    ];

    useEffect(() => {
        if (!mountRef.current) return;

        // Clear existing children
        if (mountRef.current.hasChildNodes()) {
            while (mountRef.current.firstChild) {
                mountRef.current.removeChild(mountRef.current.firstChild);
            }
        }

        // Calculate district layout - larger, more spaced districts
        const numDistricts = directories.length;
        const districtGridSize = Math.ceil(Math.sqrt(numDistricts));
        const districtSpacing = 40;
        const districtRadius = 16;

        // Create district positions
        const districts = directories.map((dir, idx) => {
            const row = Math.floor(idx / districtGridSize);
            const col = idx % districtGridSize;
            const x = (col - districtGridSize / 2 + 0.5) * districtSpacing;
            const z = (row - districtGridSize / 2 + 0.5) * districtSpacing;
            return {
                name: dir,
                shortName: dir.split('/').pop() || 'root',
                x,
                z,
                files: fileGroups[dir],
                colorScheme: districtColors[idx % districtColors.length]
            };
        });

        // Calculate platform bounds
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        districts.forEach(d => {
            minX = Math.min(minX, d.x - districtRadius);
            maxX = Math.max(maxX, d.x + districtRadius);
            minZ = Math.min(minZ, d.z - districtRadius);
            maxZ = Math.max(maxZ, d.z + districtRadius);
        });

        const margin = 20;
        const platformCenterX = (minX + maxX) / 2;
        const platformCenterZ = (minZ + maxZ) / 2;
        const platformSize = Math.max((maxX - minX) + margin * 2, (maxZ - minZ) + margin * 2, 80);

        // Scene setup
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Beautiful daytime sky gradient
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        const gradient = context.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, '#0ea5e9');      // Sky blue top
        gradient.addColorStop(0.3, '#38bdf8');    // Lighter blue
        gradient.addColorStop(0.6, '#7dd3fc');    // Even lighter
        gradient.addColorStop(1, '#e0f2fe');      // Almost white horizon
        context.fillStyle = gradient;
        context.fillRect(0, 0, 2, 512);

        const texture = new THREE.CanvasTexture(canvas);
        scene.background = texture;
        scene.fog = new THREE.Fog(0x7dd3fc, 150, 500);

        // Camera
        const camera = new THREE.PerspectiveCamera(
            55,
            mountRef.current.clientWidth / mountRef.current.clientHeight,
            0.1,
            1000
        );
        const cameraDistance = platformSize * 0.7;
        camera.position.set(cameraDistance, cameraDistance * 0.5, cameraDistance);
        camera.lookAt(platformCenterX, 0, platformCenterZ);
        cameraRef.current = camera;

        // Renderer with better settings
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance'
        });
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        rendererRef.current = renderer;
        mountRef.current.appendChild(renderer.domElement);

        // Modern lighting setup
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.5);
        sunLight.position.set(60, 100, 40);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 300;
        sunLight.shadow.camera.left = -100;
        sunLight.shadow.camera.right = 100;
        sunLight.shadow.camera.top = 100;
        sunLight.shadow.camera.bottom = -100;
        scene.add(sunLight);

        // Hemisphere light for natural outdoor feel
        const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x98FB98, 0.4);
        scene.add(hemiLight);

        // Rim light for depth
        const rimLight = new THREE.DirectionalLight(0x88ccff, 0.3);
        rimLight.position.set(-50, 30, -50);
        scene.add(rimLight);

        // Arrays for cleanup
        const geometriesToDispose = [];
        const materialsToDispose = [];
        const cylinderMeshes = [];
        const palmTrees = [];
        const dolphins = [];

        // Beautiful ocean with gradient
        const oceanGeometry = new THREE.PlaneGeometry(platformSize * 4, platformSize * 4, 150, 150);
        const oceanMaterial = new THREE.MeshStandardMaterial({
            color: 0x0891b2,
            roughness: 0.1,
            metalness: 0.8,
            transparent: true,
            opacity: 0.85
        });
        const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
        ocean.rotation.x = -Math.PI / 2;
        ocean.position.y = -3;
        ocean.receiveShadow = true;
        scene.add(ocean);

        const oceanVertices = oceanGeometry.attributes.position;
        const originalPositions = [];
        for (let i = 0; i < oceanVertices.count; i++) {
            originalPositions.push(oceanVertices.getZ(i));
        }

        // Main Island - beautiful sandy island with smooth edges
        const islandWidth = (maxX - minX) + 25;
        const islandDepth = (maxZ - minZ) + 25;

        // Island base (sandy)
        const islandGeometry = new THREE.CylinderGeometry(
            Math.max(islandWidth, islandDepth) / 2 + 5,
            Math.max(islandWidth, islandDepth) / 2 + 10,
            4,
            64
        );
        const islandMaterial = new THREE.MeshStandardMaterial({
            color: 0xf5d5a8,
            roughness: 0.9,
            metalness: 0.0
        });
        const island = new THREE.Mesh(islandGeometry, islandMaterial);
        island.position.set(platformCenterX, -1, platformCenterZ);
        island.receiveShadow = true;
        island.castShadow = true;
        scene.add(island);

        // Create districts with clear visual separation
        districts.forEach((district, idx) => {
            // District platform - raised, colored, circular
            const platformGeometry = new THREE.CylinderGeometry(districtRadius, districtRadius + 1, 1.5, 32);
            const platformMaterial = new THREE.MeshStandardMaterial({
                color: district.colorScheme.ground,
                roughness: 0.4,
                metalness: 0.3
            });
            const platform = new THREE.Mesh(platformGeometry, platformMaterial);
            platform.position.set(district.x, 1.25, district.z);
            platform.receiveShadow = true;
            platform.castShadow = true;
            scene.add(platform);
            geometriesToDispose.push(platformGeometry);
            materialsToDispose.push(platformMaterial);

            // Glowing ring border around district
            const ringGeometry = new THREE.TorusGeometry(districtRadius + 0.5, 0.4, 16, 64);
            const ringMaterial = new THREE.MeshStandardMaterial({
                color: district.colorScheme.accent,
                emissive: district.colorScheme.accent,
                emissiveIntensity: 0.3,
                roughness: 0.2,
                metalness: 0.8
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(district.x, 2.1, district.z);
            scene.add(ring);
            geometriesToDispose.push(ringGeometry);
            materialsToDispose.push(ringMaterial);

            // District name pillar with floating text indicator
            const pillarGeometry = new THREE.CylinderGeometry(0.3, 0.5, 4, 16);
            const pillarMaterial = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.3,
                metalness: 0.5
            });
            const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
            pillar.position.set(district.x, 4, district.z);
            pillar.castShadow = true;
            scene.add(pillar);
            geometriesToDispose.push(pillarGeometry);
            materialsToDispose.push(pillarMaterial);

            // Glowing orb on top of pillar
            const orbGeometry = new THREE.SphereGeometry(0.6, 16, 16);
            const orbMaterial = new THREE.MeshStandardMaterial({
                color: district.colorScheme.accent,
                emissive: district.colorScheme.accent,
                emissiveIntensity: 0.5,
                roughness: 0.1,
                metalness: 0.9
            });
            const orb = new THREE.Mesh(orbGeometry, orbMaterial);
            orb.position.set(district.x, 6.5, district.z);
            scene.add(orb);
            geometriesToDispose.push(orbGeometry);
            materialsToDispose.push(orbMaterial);

            // Create cylinders for files in this district - arranged in a circle
            const files = district.files;
            const numFiles = files.length;
            const angleStep = (Math.PI * 2) / Math.max(numFiles, 1);
            const fileRadius = districtRadius * 0.65;

            files.forEach((file, fileIdx) => {
                const { totalLoc, avgComplexity } = calculateFileMetrics(file);

                // Scale height based on complexity (min 3, max 20)
                const height = avgComplexity > 0
                    ? 3 + (avgComplexity / maxComplexity) * 17
                    : 3;

                // Scale radius based on LOC (min 0.8, max 2.5)
                const radius = 0.8 + (totalLoc / maxLoc) * 1.7;

                // Position files in a circle around district center
                const angle = fileIdx * angleStep - Math.PI / 2;
                const fileX = district.x + Math.cos(angle) * fileRadius;
                const fileZ = district.z + Math.sin(angle) * fileRadius;

                // Beautiful cylinder with gradient-like effect
                const cylinderGeometry = new THREE.CylinderGeometry(
                    radius * 0.9, radius, height, 24, 1
                );
                const color = getComplexityColor(avgComplexity);
                const cylinderMaterial = new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: 0.25,
                    metalness: 0.7,
                    emissive: color,
                    emissiveIntensity: 0.1
                });

                const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
                cylinder.position.set(fileX, height / 2 + 2, fileZ);
                cylinder.castShadow = true;
                cylinder.receiveShadow = true;

                // Store file data for hover/click
                cylinder.userData = {
                    filename: file.filename,
                    shortName: file.filename?.split('/').pop() || 'Unknown',
                    directory: district.shortName,
                    directoryFull: district.name,
                    totalLoc,
                    avgComplexity: avgComplexity.toFixed(2),
                    numFunctions: (file.functions || []).length,
                    districtColor: district.colorScheme.name
                };

                scene.add(cylinder);
                cylinderMeshes.push(cylinder);
                geometriesToDispose.push(cylinderGeometry);
                materialsToDispose.push(cylinderMaterial);

                // Glowing top cap
                const capGeometry = new THREE.CylinderGeometry(
                    radius * 0.9, radius * 0.9, 0.3, 24
                );
                const capMaterial = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    emissive: color,
                    emissiveIntensity: 0.3,
                    roughness: 0.1,
                    metalness: 0.9
                });
                const cap = new THREE.Mesh(capGeometry, capMaterial);
                cap.position.set(fileX, height + 2.15, fileZ);
                scene.add(cap);
                geometriesToDispose.push(capGeometry);
                materialsToDispose.push(capMaterial);
            });
        });

        // Beautiful palm trees
        const numPalmTrees = 8;
        const islandRadius = Math.max(islandWidth, islandDepth) / 2;
        for (let i = 0; i < numPalmTrees; i++) {
            const angle = (i / numPalmTrees) * Math.PI * 2;
            const treeRadius = islandRadius + 3;
            const x = platformCenterX + Math.cos(angle) * treeRadius;
            const z = platformCenterZ + Math.sin(angle) * treeRadius;

            // Curved trunk
            const trunkGeometry = new THREE.CylinderGeometry(0.25, 0.4, 6, 12);
            const trunkMaterial = new THREE.MeshStandardMaterial({
                color: 0x8b5a2b,
                roughness: 0.9
            });
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.set(x, 3.5, z);
            trunk.rotation.z = Math.sin(angle) * 0.15;
            trunk.rotation.x = Math.cos(angle) * 0.15;
            trunk.castShadow = true;
            scene.add(trunk);
            palmTrees.push(trunk);
            geometriesToDispose.push(trunkGeometry);
            materialsToDispose.push(trunkMaterial);

            // Lush palm leaves
            for (let j = 0; j < 7; j++) {
                const leafAngle = (j / 7) * Math.PI * 2;
                const leafGeometry = new THREE.ConeGeometry(0.8, 3.5, 4);
                const leafMaterial = new THREE.MeshStandardMaterial({
                    color: 0x22c55e,
                    roughness: 0.6
                });
                const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
                const leafX = x + Math.cos(leafAngle) * 1.2 + trunk.rotation.z * 2;
                const leafZ = z + Math.sin(leafAngle) * 1.2 + trunk.rotation.x * 2;
                leaf.position.set(leafX, 7, leafZ);
                leaf.rotation.z = Math.cos(leafAngle) * 0.6;
                leaf.rotation.x = Math.sin(leafAngle) * 0.6;
                leaf.castShadow = true;
                scene.add(leaf);
                palmTrees.push(leaf);
                geometriesToDispose.push(leafGeometry);
                materialsToDispose.push(leafMaterial);
            }
        }

        // Playful dolphins
        const numDolphins = 3;
        for (let i = 0; i < numDolphins; i++) {
            const dolphinGroup = new THREE.Group();

            // Body
            const bodyGeometry = new THREE.SphereGeometry(1, 16, 12);
            const dolphinMaterial = new THREE.MeshStandardMaterial({
                color: 0x64748b,
                metalness: 0.4,
                roughness: 0.5
            });
            const body = new THREE.Mesh(bodyGeometry, dolphinMaterial);
            body.scale.set(1, 0.5, 2);
            dolphinGroup.add(body);
            geometriesToDispose.push(bodyGeometry);
            materialsToDispose.push(dolphinMaterial);

            // Fin
            const finGeometry = new THREE.ConeGeometry(0.3, 0.8, 4);
            const fin = new THREE.Mesh(finGeometry, dolphinMaterial);
            fin.position.set(0, 0.5, 0);
            fin.rotation.x = Math.PI;
            dolphinGroup.add(fin);
            geometriesToDispose.push(finGeometry);

            const angle = (i / numDolphins) * Math.PI * 2;
            const radius = platformSize * 1.3;
            dolphinGroup.position.set(
                platformCenterX + Math.cos(angle) * radius,
                -2,
                platformCenterZ + Math.sin(angle) * radius
            );

            scene.add(dolphinGroup);
            dolphins.push({ group: dolphinGroup, angle: angle, phase: i * 2.5, radius });
        }

        // Raycaster for interaction
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        // Keyboard controls
        const handleKeyDown = (event) => {
            keysRef.current[event.key.toLowerCase()] = true;
        };

        const handleKeyUp = (event) => {
            keysRef.current[event.key.toLowerCase()] = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        const initialEuler = new THREE.Euler().setFromQuaternion(camera.quaternion);
        let yaw = initialEuler.y;
        let pitch = initialEuler.x;
        let isMouseLocked = false;

        const onMouseClick = (event) => {
            if (!mountRef.current) return;

            const rect = mountRef.current.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(cylinderMeshes);

            if (intersects.length > 0 && onFunctionClick && !isMouseLocked) {
                const clickedMesh = intersects[0].object;
                const fileData = clickedMesh.userData;

                const file = individualFiles.find(f => f.filename === fileData.filename);
                if (file && file.functions && file.functions.length > 0) {
                    const firstFn = file.functions[0];
                    onFunctionClick({
                        filename: fileData.filename,
                        functionName: firstFn.name || 'File Overview',
                        startLine: firstFn.start_line || 1,
                        nloc: firstFn.nloc || fileData.totalLoc,
                        complexity: firstFn.cyclomatic_complexity
                    });
                }
            } else {
                if (!isMouseLocked) {
                    mountRef.current.requestPointerLock();
                } else {
                    document.exitPointerLock();
                }
            }
        };

        const onPointerLockChange = () => {
            isMouseLocked = document.pointerLockElement === mountRef.current;
            if (mountRef.current) {
                mountRef.current.style.cursor = isMouseLocked ? 'none' : 'pointer';
            }
        };

        const onMouseMove = (event) => {
            if (!mountRef.current) return;

            if (!isMouseLocked) {
                const rect = mountRef.current.getBoundingClientRect();
                mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                setHoverInfoPosition({ x: event.clientX + 15, y: event.clientY });

                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(cylinderMeshes);

                cylinderMeshes.forEach(mesh => {
                    if (mesh.material && !Array.isArray(mesh.material)) {
                        mesh.material.emissiveIntensity = 0.1;
                    }
                });

                if (intersects.length > 0) {
                    const hoveredMesh = intersects[0].object;
                    if (hoveredMesh.material && !Array.isArray(hoveredMesh.material)) {
                        hoveredMesh.material.emissiveIntensity = 0.5;
                        setHoveredCylinder(hoveredMesh.userData);
                    }
                } else {
                    setHoveredCylinder(null);
                }
            } else {
                const movementX = event.movementX || 0;
                const movementY = event.movementY || 0;

                yaw -= movementX * 0.002;
                pitch -= movementY * 0.002;
                pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
            }
        };

        document.addEventListener('pointerlockchange', onPointerLockChange);
        mountRef.current.addEventListener('click', onMouseClick);
        mountRef.current.addEventListener('mousemove', onMouseMove);

        if (mountRef.current) {
            mountRef.current.style.cursor = 'pointer';
        }

        // Animation loop
        let time = 0;
        const animate = () => {
            animationIdRef.current = requestAnimationFrame(animate);
            time += 0.015;

            // Gentle ocean waves
            for (let i = 0; i < oceanVertices.count; i++) {
                const x = oceanVertices.getX(i);
                const y = oceanVertices.getY(i);
                const wave = Math.sin(x * 0.05 + time) * 0.8 +
                    Math.cos(y * 0.05 + time * 0.8) * 0.6 +
                    Math.sin(x * 0.1 + y * 0.1 + time * 1.2) * 0.3;
                oceanVertices.setZ(i, originalPositions[i] + wave);
            }
            oceanVertices.needsUpdate = true;

            // Palm tree gentle sway
            palmTrees.forEach((tree, i) => {
                if (tree.geometry.type === 'CylinderGeometry' && tree.geometry.parameters.radiusTop < 0.5) {
                    tree.rotation.z += Math.sin(time * 0.5 + i) * 0.0005;
                }
            });

            // Dolphins jumping
            dolphins.forEach(dolphin => {
                const jumpCycle = time * 1.5 + dolphin.phase;
                const jumpHeight = Math.sin(jumpCycle) * 4;
                dolphin.group.position.y = -2 + Math.max(0, jumpHeight);
                dolphin.group.rotation.x = jumpHeight > 0 ? Math.sin(jumpCycle) * 0.6 : 0;

                // Swimming motion
                dolphin.angle += 0.003;
                dolphin.group.position.x = platformCenterX + Math.cos(dolphin.angle) * dolphin.radius;
                dolphin.group.position.z = platformCenterZ + Math.sin(dolphin.angle) * dolphin.radius;
                dolphin.group.rotation.y = -dolphin.angle + Math.PI / 2;
            });

            // Camera controls
            const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
            camera.quaternion.setFromEuler(euler);

            const keys = keysRef.current;
            const moveVector = new THREE.Vector3();

            if (keys['w']) moveVector.z -= moveSpeed;
            if (keys['s']) moveVector.z += moveSpeed;
            if (keys['a']) moveVector.x -= moveSpeed;
            if (keys['d']) moveVector.x += moveSpeed;
            if (keys['q']) moveVector.y += moveSpeed;
            if (keys['e']) moveVector.y -= moveSpeed;

            if (moveVector.length() > 0) {
                const cameraDirection = new THREE.Vector3();
                camera.getWorldDirection(cameraDirection);
                cameraDirection.y = 0;
                cameraDirection.normalize();

                const rightVector = new THREE.Vector3();
                rightVector.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));

                const forwardMovement = cameraDirection.multiplyScalar(-moveVector.z);
                const rightMovement = rightVector.multiplyScalar(moveVector.x);
                const verticalMovement = new THREE.Vector3(0, moveVector.y, 0);

                camera.position.add(forwardMovement);
                camera.position.add(rightMovement);
                camera.position.add(verticalMovement);
            }

            renderer.render(scene, camera);
        };
        animate();

        // Resize handler
        const handleResize = () => {
            if (!mountRef.current) return;
            camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
            }

            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            document.removeEventListener('pointerlockchange', onPointerLockChange);

            if (mountRef.current && renderer.domElement) {
                mountRef.current.removeEventListener('click', onMouseClick);
                mountRef.current.removeEventListener('mousemove', onMouseMove);
                if (mountRef.current.contains(renderer.domElement)) {
                    mountRef.current.removeChild(renderer.domElement);
                }
            }

            geometriesToDispose.forEach(geom => geom.dispose());
            materialsToDispose.forEach(mat => mat.dispose());
            oceanGeometry.dispose();
            oceanMaterial.dispose();
            islandGeometry.dispose();
            islandMaterial.dispose();

            renderer.dispose();
            sceneRef.current = null;
            rendererRef.current = null;
            cameraRef.current = null;
        };
    }, [individualFiles, onFunctionClick, minComplexity, maxComplexity, maxLoc]);

    return (
        <div className="relative w-full h-full">
            <div ref={mountRef} className="w-full h-full" style={{ minHeight: '55vh' }} />

            {/* Hover tooltip */}
            {hoveredCylinder && (
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
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: `#${getComplexityColor(parseFloat(hoveredCylinder.avgComplexity)).toString(16).padStart(6, '0')}` }}
                            />
                            <span className="font-bold text-gray-900">{hoveredCylinder.shortName}</span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex justify-between gap-4">
                                <span>Directory:</span>
                                <span className="font-medium text-gray-900">{hoveredCylinder.directory}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span>Avg Complexity:</span>
                                <span className="font-medium text-gray-900">{hoveredCylinder.avgComplexity}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span>Lines of Code:</span>
                                <span className="font-medium text-gray-900">{hoveredCylinder.totalLoc}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span>Functions:</span>
                                <span className="font-medium text-gray-900">{hoveredCylinder.numFunctions}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Controls panel - modern glassmorphism */}
            <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-md rounded-xl shadow-lg p-4 z-10 border border-white/50">
                <h4 className="font-bold text-sm mb-2 text-gray-800 flex items-center gap-2">
                    <span className="text-base">🎮</span> Controls
                </h4>
                <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">WASD</kbd>
                        <span>Move around</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Q/E</kbd>
                        <span>Up / Down</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">ESC</kbd>
                        <span>Exit look mode</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Click</kbd>
                        <span>View file code</span>
                    </div>
                </div>
            </div>

            {/* Legend panel - modern glassmorphism */}
            <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-md rounded-xl shadow-lg p-4 z-10 border border-white/50">
                <h4 className="font-bold text-sm mb-3 text-gray-800 flex items-center gap-2">
                    <span className="text-base">🏝️</span> Island Code Districts
                </h4>
                <div className="space-y-2 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gradient-to-t from-gray-400 to-gray-300 rounded" />
                        <span>Height = Avg Complexity</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-4 bg-gradient-to-r from-gray-300 to-gray-400 rounded-full" />
                        <span>Width = Lines of Code</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-purple-400" />
                        <span>Color = Directory Group</span>
                    </div>
                    <div className="mt-3 pt-2 border-t border-gray-200">
                        <div className="text-[10px] font-medium text-gray-500 mb-1.5">Complexity Scale</div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }} />
                            <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500" />
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f43f5e' }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                            <span>Low</span>
                            <span>High</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Island3DVisualization;
