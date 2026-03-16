// 3D Island Visualization: Immersive Code City
import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import * as d3 from 'd3';
import gsap from 'gsap';
import { Settings } from 'lucide-react';
import FunctionTableView from './FunctionTableView';
import { SceneDiffer } from '../../../utils/SceneDiffer';

function Island3DVisualization({ individualFiles, onFunctionClick, onFileClick, isDarkMode, isTimelinePlaying, animatingCommit, showContributors = false }) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const animationIdRef = useRef(null);
    const cameraRef = useRef(null);

    const [hoveredObject, setHoveredObject] = useState(null);
    const [hoverInfoPosition, setHoverInfoPosition] = useState({ x: 0, y: 0 });

    const [rebuildTrigger, setRebuildTrigger] = useState(0);

    // New Interaction State
    const [viewMode, setViewMode] = useState('island'); // 'island' | 'functions'
    const [focusedFile, setFocusedFile] = useState(null);
    const [menuPosition, setMenuPosition] = useState(null); // { x, y }
    const [activeFileForMenu, setActiveFileForMenu] = useState(null);

    // Visualization Options
    const [towerOpacity, setTowerOpacity] = useState(1.0); // 0.0 to 1.0
    const [showDecorations, setShowDecorations] = useState(false);
    const [showOptionsPanel, setShowOptionsPanel] = useState(false);
    const [vizStyle, setVizStyle] = useState('circular'); // 'circular' | 'honeycomb' | 'freeform'
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isSearchActive, setIsSearchActive] = useState(false);



    const keysRef = useRef({});
    const moveSpeed = 1.5;

    // Persist Camera Orientation
    const yawRef = useRef(0);
    const pitchRef = useRef(-0.6); // Look down

    // Incremental Update Tracking
    const previousFilesRef = useRef(null);
    const buildingMeshesRef = useRef(new Map()); // filename -> { mesh, cap, data }
    const directoryMeshesRef = useRef(new Map()); // path -> { mesh, ring }
    const previousVizStyleRef = useRef(vizStyle);
    const sceneInitializedRef = useRef(false);

    // Contributor & Animation Refs
    const contributorDronesRef = useRef(new Map()); // authorName -> { group, label, color }
    const lastProcessedCommitRef = useRef(null);
    const pendingStrikeFilesRef = useRef([]); // Files changed in most recent diff
    const laserGroupRef = useRef(null);
    // Refs for values needed inside useEffect without adding them as dependencies
    const animatingCommitRef = useRef(animatingCommit);
    const isTimelinePlayingRef = useRef(isTimelinePlaying);
    const showContributorsRef = useRef(showContributors);
    const searchBeaconRef = useRef(null);
    const highlightTimelineRef = useRef(null);
    const focusedMeshRef = useRef(null);
    const focusedCapRef = useRef(null);
    const focusedMeshOrigYRef = useRef(0);
    const focusedCapOrigYRef = useRef(0);
    const searchFocusedRef = useRef(isSearchFocused);
    animatingCommitRef.current = animatingCommit;
    searchFocusedRef.current = isSearchFocused;

    isTimelinePlayingRef.current = isTimelinePlaying;
    showContributorsRef.current = showContributors;

    if (!individualFiles || individualFiles.length === 0) {
        return (
            <div className={`flex items-center justify-center h-full ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                No files to visualize
            </div>
        );
    }
    const { islandSize, islandCenterX, islandCenterZ } = useMemo(() => {
        const numFiles = individualFiles?.length || 0;
        const size = Math.max(400, Math.sqrt(numFiles) * 35);
        return {
            islandSize: size,
            islandCenterX: size / 2,
            islandCenterZ: size / 2
        };
    }, [individualFiles?.length]);

    // --- Data Processing Helpers ---

    // --- Hexagonal Grid Setup ---
    const HEX_RADIUS = 3.5;
    const HEX_HEIGHT = 1.0;
    const HEX_MARGIN = 0.2;
    const HEX_WIDTH = Math.sqrt(3) * HEX_RADIUS;
    const HEX_VERT_DIST = HEX_RADIUS * 1.5;

    const axialToPixel = (q, r) => {
        const x = HEX_WIDTH * (q + r / 2);
        const z = HEX_VERT_DIST * r;
        return { x, z };
    };

    const pixelToAxial = (x, z) => {
        const q = (Math.sqrt(3) / 3 * x - 1 / 3 * z) / HEX_RADIUS;
        const r = (2 / 3 * z) / HEX_RADIUS;
        return hexRound(q, r);
    };

    const hexRound = (q, r) => {
        let x = q;
        let z = r;
        let y = -x - z;

        let rx = Math.round(x);
        let rz = Math.round(z);
        let ry = Math.round(y);

        const x_diff = Math.abs(rx - x);
        const z_diff = Math.abs(rz - z);
        const y_diff = Math.abs(ry - y);

        if (x_diff > z_diff && x_diff > y_diff) {
            rx = -ry - rz;
        } else if (z_diff > y_diff) {
            rz = -rx - ry;
        }

        return { q: rx, r: rz };
    };

    // --- Organic Shape Utilities ---
    const getConvexHull = (points) => {
        if (points.length <= 2) return points;
        // Sort by x, then y
        const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);

        const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

        const upper = [];
        for (let p of sorted) {
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
            upper.push(p);
        }

        const lower = [];
        for (let i = sorted.length - 1; i >= 0; i--) {
            const p = sorted[i];
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
            lower.push(p);
        }

        upper.pop();
        lower.pop();
        return upper.concat(lower);
    };

    const organicShapeCacheRef = useRef(new Map());

    const getOrganicShape = (nodes, padding = 15) => {
        if (nodes.length === 0) return null;

        // Optimization: Create a unique cache key based on nodes and padding
        const cacheKey = nodes.length + '_' + padding + '_' + (nodes[0]?.depth || 0) + '_' + (nodes[0]?.x?.toFixed(1) || '');
        if (organicShapeCacheRef.current.has(cacheKey)) {
            return organicShapeCacheRef.current.get(cacheKey);
        }

        // 1. Generate point cloud around all children
        const points = [];
        nodes.forEach(node => {
            const r = (node.r || 5) + padding;
            // Sample points around the circle
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                points.push({
                    x: node.x + Math.cos(angle) * r,
                    y: node.y + Math.sin(angle) * r
                });
            }
        });

        // 2. Compute Convex Hull
        const hull = getConvexHull(points);
        if (hull.length < 3) return null;

        // 3. Create Three.js Shape with Bezier smoothing
        const shape = new THREE.Shape();

        // Midpoint start
        const pLast = hull[hull.length - 1];
        const pFirst = hull[0];
        const startX = (pLast.x + pFirst.x) / 2;
        const startY = (pLast.y + pFirst.y) / 2;

        shape.moveTo(startX, startY);

        const bezierPoints = [];
        for (let i = 0; i < hull.length; i++) {
            const p1 = hull[i];
            const p2 = hull[(i + 1) % hull.length];
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            // Curve through hull vertex p1 to the midpoint of next edge
            shape.quadraticCurveTo(p1.x, p1.y, midX, midY);

            // Generate dense sampling points for the curve to allow accurate honeycomb filling
            const prevMidX = i === 0 ? (hull[hull.length - 1].x + hull[0].x) / 2 : (hull[i - 1].x + hull[i].x) / 2;
            const prevMidY = i === 0 ? (hull[hull.length - 1].y + hull[0].y) / 2 : (hull[i - 1].y + hull[i].y) / 2;

            // Dynamic sampling resolution based on distance
            const dist = Math.sqrt((midX - prevMidX) ** 2 + (midY - prevMidY) ** 2);
            const steps = Math.max(5, Math.ceil(dist / 10)); // Optimize number of steps

            for (let t = 0; t <= 1; t += (1 / steps)) {
                const x = (1 - t) * (1 - t) * prevMidX + 2 * (1 - t) * t * p1.x + t * t * midX;
                const y = (1 - t) * (1 - t) * prevMidY + 2 * (1 - t) * t * p1.y + t * t * midY;
                bezierPoints.push({ x, y });
            }
        }

        const result = { shape, hull, bezierPoints };
        organicShapeCacheRef.current.set(cacheKey, result);
        return result;
    };

    const isPointInShape = (px, py, hullPoints) => {
        // AABB early-exit optimization
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (let i = 0; i < hullPoints.length; i++) {
            if (hullPoints[i].x < minX) minX = hullPoints[i].x;
            if (hullPoints[i].x > maxX) maxX = hullPoints[i].x;
            if (hullPoints[i].y < minY) minY = hullPoints[i].y;
            if (hullPoints[i].y > maxY) maxY = hullPoints[i].y;
        }
        if (px < minX || px > maxX || py < minY || py > maxY) return false;

        let isInside = false;
        for (let i = 0, j = hullPoints.length - 1; i < hullPoints.length; j = i++) {
            const xi = hullPoints[i].x, yi = hullPoints[i].y;
            const xj = hullPoints[j].x, yj = hullPoints[j].y;
            const intersect = ((yi > py) !== (yj > py)) &&
                (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
            if (intersect) isInside = !isInside;
        }
        return isInside;
    };

    const calculateFileMetrics = (file) => {
        const totalLoc = file.total_nloc || file.total_loc || 1;
        const totalComplexity = file.total_complexity || 0;
        const maintainabilityIndex = file.maintainability_index ?? 100;

        return { totalLoc, totalComplexity, maintainabilityIndex, numFunctions: (file.functions || []).length };
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
                        const { totalLoc, totalComplexity, maintainabilityIndex, numFunctions } = calculateFileMetrics(file);
                        existingNode = {
                            name: part,
                            type: 'file',
                            fileData: file,
                            value: totalLoc, // D3 pack uses 'value' for size
                            totalComplexity: totalComplexity,
                            maintainabilityIndex: maintainabilityIndex,
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
        if (complexity === undefined || complexity === null) return 0x6b7280;

        // Intensity mapping for complexity (High complexity = Bad/Red, Low = Good/Cyan-Green)
        if (isDarkMode) {
            if (complexity >= 20) return 0xef4444; // Red (Bad)
            if (complexity >= 15) return 0xec4899; // Pink
            if (complexity >= 10) return 0xa855f7; // Purple
            return 0x06b6d4; // Cyan (Good)
        } else {
            if (complexity >= 20) return 0xef4444; // Bright Red
            if (complexity >= 15) return 0xf97316; // Bright Orange
            if (complexity >= 10) return 0xfacc15; // Bright Yellow
            return 0x22c55e; // Bright Green (Good)
        }
    };

    const getMaintainabilityColor = (index) => {
        if (index === undefined || index === null) {
            return 0x6b7280; // Gray
        }

        const clamped = Math.max(0, Math.min(100, index));

        if (isDarkMode) {
            if (clamped < 10) {
                // 0-9: red
                return 0xef4444;
            } else if (clamped < 15) {
                // 10-14: pink
                return 0xec4899;
            } else if (clamped < 20) {
                // 15-19: purple
                return 0xa855f7;
            } else {
                // 20-100: cyan
                return 0x06b6d4;
            }
        }
        else {
            if (clamped < 10) {
                // 0-9: bright red
                return 0xef4444;
            } else if (clamped < 15) {
                // 10-14: bright orange
                return 0xf97316;
            } else if (clamped < 20) {
                // 15-19: bright yellow
                return 0xfacc15;
            } else {
                // 20-100: bright green
                return 0x22c55e;
            }
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

    const getAuthorColor = (name) => {
        if (!name) return 0xffffff;
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const colors = [
            0x38bdf8, // sky
            0x818cf8, // indigo
            0xc084fc, // purple
            0xf472b6, // pink
            0xfb7185, // rose
            0xfbbf24, // amber
            0x34d399, // emerald
            0x2dd4bf, // teal
        ];
        return colors[Math.abs(hash) % colors.length];
    };

    // --- Animation Helper Functions ---

    const animateBuildingHeight = (mesh, cap, targetHeight, currentHeight, duration = 0.5) => {
        // Skip animations during timeline playback for performance
        const animDuration = isTimelinePlayingRef.current ? 0 : duration;
        const scale = targetHeight / currentHeight;

        gsap.to(mesh.scale, {
            y: scale,
            duration: animDuration,
            ease: "power2.inOut"
        });

        // Adjust position to keep bottom fixed
        const currentY = mesh.position.y;
        const targetY = currentY + (targetHeight - currentHeight) / 2;

        gsap.to(mesh.position, {
            y: targetY,
            duration: animDuration,
            ease: "power2.inOut"
        });

        // Move cap to new top
        if (cap) {
            gsap.to(cap.position, {
                y: cap.position.y + (targetHeight - currentHeight),
                duration: animDuration,
                ease: "power2.inOut"
            });
        }
    };

    const animateBuildingColor = (mesh, cap, targetColor, duration = 0.5) => {
        const animDuration = isTimelinePlayingRef.current ? 0 : duration;
        const r = ((targetColor >> 16) & 255) / 255;
        const g = ((targetColor >> 8) & 255) / 255;
        const b = (targetColor & 255) / 255;

        gsap.to(mesh.material.color, {
            r, g, b,
            duration: animDuration,
            ease: "power2.inOut"
        });

        if (mesh.material.emissive) {
            gsap.to(mesh.material.emissive, {
                r, g, b,
                duration: animDuration,
                ease: "power2.inOut"
            });
        }

        if (cap && cap.material.emissive) {
            gsap.to(cap.material.emissive, {
                r, g, b,
                duration: animDuration,
                ease: "power2.inOut"
            });
        }
    };

    const animateBuildingFadeIn = (mesh, cap, duration = 0.5) => {
        const animDuration = isTimelinePlayingRef.current ? 0 : duration;
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
            duration: animDuration,
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
                duration: animDuration,
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
        const animDuration = isTimelinePlayingRef.current ? 0 : duration;
        mesh.material.transparent = true;
        if (cap) cap.material.transparent = true;

        gsap.to(mesh.material, {
            opacity: 0,
            duration: animDuration,
            ease: "power2.inOut"
        });

        if (cap) {
            gsap.to(cap.material, {
                opacity: 0,
                duration: animDuration,
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
                duration: animDuration,
                ease: "power2.inOut",
                onComplete: () => {
                    mesh.visible = false;
                    onComplete?.();
                }
            });
        }
    };

    const createDrone = (author, scene, islandCenterX, islandCenterZ) => {
        if (!author) return null;
        if (contributorDronesRef.current.has(author)) return contributorDronesRef.current.get(author);

        console.log(`[Island3D] Creating new drone for ${author}`);
        const group = new THREE.Group();
        const color = getAuthorColor(author);

        // UFO Body (Disk) - Even Larger
        const diskGeo = new THREE.CylinderGeometry(12, 16, 4, 16);
        const diskMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            metalness: 0.9,
            roughness: 0.2,
            emissive: color,
            emissiveIntensity: 0.5
        });
        const disk = new THREE.Mesh(diskGeo, diskMat);
        group.add(disk);

        // UFO Dome - Even Larger
        const domeGeo = new THREE.SphereGeometry(8, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.6,
            metalness: 0.5,
            roughness: 0.1
        });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = 1.5;
        group.add(dome);

        // Lights around the rim - Scaled
        for (let j = 0; j < 8; j++) {
            const lightGeo = new THREE.SphereGeometry(1.2, 8, 8);
            const lightMat = new THREE.MeshBasicMaterial({ color: color });
            const light = new THREE.Mesh(lightGeo, lightMat);
            const angle = (j / 8) * Math.PI * 2;
            light.position.set(Math.cos(angle) * 14, 0, Math.sin(angle) * 14);
            group.add(light);
        }

        // Name Label (Canvas Texture) - Wider for long names
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 1024, 128);
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
        ctx.fillText(author, 512, 85);

        const spriteMap = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: spriteMap, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.y = 25;
        sprite.scale.set(60, 8, 1);
        group.add(sprite);

        const orbitRadius = (islandSize * 0.45) + (contributorDronesRef.current.size * 30);
        const orbitAngle = Math.random() * Math.PI * 2;
        const baseHoverY = 120 + Math.random() * 40;
        group.position.set(
            islandCenterX + Math.cos(orbitAngle) * orbitRadius,
            baseHoverY,
            islandCenterZ + Math.sin(orbitAngle) * orbitRadius
        );
        group.userData = { type: 'drone', author };

        scene.add(group);
        const droneData = {
            group,
            color,
            radius: orbitRadius,
            angle: orbitAngle,
            speed: 0.002 + Math.random() * 0.003,
            baseY: baseHoverY // Store for absolute hover logic
        };
        contributorDronesRef.current.set(author, droneData);
        return droneData;
    };

    const triggerLaserStrike = (author, modifiedFiles, scene) => {
        if (!author || !modifiedFiles || modifiedFiles.length === 0) {
            console.log(`[Island3D] Skipping strike: author=${author}, files=${modifiedFiles?.length}`);
            return;
        }

        // Ensure drone exists
        const droneData = createDrone(author, scene, islandCenterX, islandCenterZ);
        if (!droneData) {
            console.warn(`[Island3D] Failed to find/create drone for ${author}`);
            return;
        }

        const { group: droneGroup, color } = droneData;

        modifiedFiles.forEach(filename => {
            const building = buildingMeshesRef.current.get(filename);
            if (!building) {
                console.warn(`[Island3D] Building not found for file: ${filename}`);
                return;
            }

            console.log(`[Island3D] Firing laser at ${filename}`);
            const targetPos = new THREE.Vector3();
            building.cap.getWorldPosition(targetPos);

            const startPos = new THREE.Vector3();
            droneGroup.getWorldPosition(startPos);
            // Fire from the bottom of the drone
            startPos.y -= 2;

            // 1. Create Laser Beam
            const distance = startPos.distanceTo(targetPos);
            const laserGeo = new THREE.CylinderGeometry(0.5, 0.5, distance, 8);
            const laserMat = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.8
            });
            const laser = new THREE.Mesh(laserGeo, laserMat);

            // Position and orient laser
            laser.position.copy(startPos).add(targetPos).multiplyScalar(0.5);
            laser.lookAt(targetPos);
            laser.rotateX(Math.PI / 2); // local rotation

            scene.add(laser);
            // 2. Animate Laser (Flicker, Fade, and Track)
            gsap.timeline({
                onUpdate: () => {
                    if (droneGroup && laser) {
                        const startPos = new THREE.Vector3();

                        // Force matrix update to prevent 1-frame render lag
                        droneGroup.updateMatrixWorld(true);
                        building.cap.updateMatrixWorld(true);

                        // We want the laser to come from the bottom center of the UFO
                        // We use a local offset and apply the drone's current world matrix
                        const localBottom = new THREE.Vector3(0, -2, 0);
                        localBottom.applyMatrix4(droneGroup.matrixWorld);
                        startPos.copy(localBottom);

                        // The target building cap is animating (bouncing), so we MUST read its current position too
                        const currentTargetPos = new THREE.Vector3();
                        building.cap.getWorldPosition(currentTargetPos);

                        // Midpoint between current drone bottom and moving target cap
                        const midpoint = new THREE.Vector3().copy(startPos).add(currentTargetPos).multiplyScalar(0.5);
                        laser.position.copy(midpoint);

                        // Look at target and fix orientation
                        laser.lookAt(currentTargetPos);
                        laser.rotateX(Math.PI / 2); // local rotation

                        // Stretch scale to match new distance
                        const newDistance = startPos.distanceTo(currentTargetPos);
                        laser.scale.y = newDistance / distance; // distance is the original length 
                    }
                }
            })
                .to(laser.scale, { x: 2, z: 2, duration: 0.1, yoyo: true, repeat: 1 })
                .to(laser.material, {
                    opacity: 0, duration: 0.3, onComplete: () => {
                        scene.remove(laser);
                        laserGeo.dispose();
                        laserMat.dispose();
                    }
                });

            // 3. Impact Effects on Tower
            // Growth Spurt
            const currentHeight = building.height;
            gsap.fromTo(building.mesh.scale,
                { y: building.mesh.scale.y * 1.2 },
                { y: building.mesh.scale.y, duration: 0.6, ease: "elastic.out(1, 0.3)" }
            );
            gsap.fromTo(building.cap.position,
                { y: building.cap.position.y + 5 },
                { y: building.cap.position.y, duration: 0.6, ease: "elastic.out(1, 0.3)" }
            );

            // Pulse Shockwave
            const ringGeo = new THREE.TorusGeometry(building.mesh.geometry.parameters.radiusTop + 2, 0.2, 8, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.copy(targetPos);
            ring.position.y = (building.data.depth || 1) * 3; // Position at base of tower
            scene.add(ring);

            gsap.to(ring.scale, { x: 5, y: 5, duration: 0.8, ease: "power2.out" });
            gsap.to(ring.material, {
                opacity: 0, duration: 0.8, ease: "power2.out", onComplete: () => {
                    scene.remove(ring);
                    ringGeo.dispose();
                    ringMat.dispose();
                }
            });
        });

        gsap.to(droneGroup.rotation, { z: 0.3, duration: 0.1, yoyo: true, repeat: 1 });
    };

    // --- Data Synchronization (Incremental) ---
    useEffect(() => {
        if (!sceneInitializedRef.current || !previousFilesRef.current || !sceneRef.current) return;

        const diff = SceneDiffer.diffFiles(previousFilesRef.current, individualFiles);
        if (diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0) return;

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

                // Animate height change if complexity changed
                if (oldMetrics.totalComplexity !== newMetrics.totalComplexity) {
                    const oldHeight = 10 + (Math.sqrt(oldMetrics.totalComplexity || 1) * 15);
                    const newHeight = 10 + (Math.sqrt(newMetrics.totalComplexity || 1) * 15);
                    animateBuildingHeight(buildingData.mesh, buildingData.cap, newHeight, oldHeight, 0.5);
                }

                // Animate color change if maintainability index changed
                if (oldMetrics.maintainabilityIndex !== newMetrics.maintainabilityIndex) {
                    const isUnsupported = newFile.is_unsupported;
                    const newColor = isUnsupported
                        ? (isDarkMode ? 0xcfcfcf : 0x9ca3af)
                        : getMaintainabilityColor(newMetrics.maintainabilityIndex);
                    animateBuildingColor(buildingData.mesh, buildingData.cap, newColor, 0.5);
                }

                // Update stored data
                buildingData.data = newFile;
                buildingData.mesh.userData = {
                    ...buildingData.mesh.userData, // Preserve depth and other metadata
                    ...newFile,
                    name: newFile.filename.split('/').pop(),
                    totalComplexity: newMetrics.totalComplexity.toFixed(2),
                    maintainabilityIndex: newMetrics.maintainabilityIndex,
                    totalLoc: newMetrics.totalLoc,
                    numFunctions: newMetrics.numFunctions
                };
            }
        });

        // Collect files changed in this step for laser strikes
        const changedFilenames = [
            ...diff.modified.map(f => f.filename),
            ...diff.added.map(f => f.filename)
        ];

        // Fire laser strike directly here (avoids race condition with separate useEffect)
        if (changedFilenames.length > 0 && isTimelinePlayingRef.current && animatingCommitRef.current) {
            const commitAuthor = animatingCommitRef.current.author;
            console.log(`[Island3D] Incremental diff found ${changedFilenames.length} changed files. Firing laser for ${commitAuthor}.`);
            // Small delay to let React finish rendering state from this batch
            setTimeout(() => {
                // Ensure timeline is STILL playing after the delay to prevent stranded drones
                if (sceneRef.current && isTimelinePlayingRef.current && showContributorsRef.current) {
                    createDrone(commitAuthor, sceneRef.current, islandCenterX, islandCenterZ);
                    triggerLaserStrike(commitAuthor, changedFilenames, sceneRef.current);
                }
            }, 150);
        }

        // Handle added files - need full rebuild for layout recalculation
        if (diff.added.length > 0) {
            console.log('[Island3D] New files added, doing full rebuild for layout recalculation');
            sceneInitializedRef.current = false; // Force full rebuild
            buildingMeshesRef.current.clear();
            directoryMeshesRef.current.clear();
            setRebuildTrigger(c => c + 1);
        } else {
            // No new files, incremental update complete
            previousFilesRef.current = individualFiles;
        }

    }, [individualFiles]); // Only run on data changes

    // --- Search & Focus Logic ---

    const handleSearch = (term) => {
        setSearchTerm(term);
        if (!term.trim()) {
            setSearchResults([]);
            return;
        }

        const matches = individualFiles
            .filter(f => f.filename.toLowerCase().includes(term.toLowerCase()))
            .map(f => ({
                filename: f.filename,
                name: f.filename.split('/').pop()
            }))
            .slice(0, 10); // Limit results

        setSearchResults(matches);
    };

    const clearSearchHighlight = () => {
        if (highlightTimelineRef.current) {
            highlightTimelineRef.current.kill();
            highlightTimelineRef.current = null;
        }
        if (focusedMeshRef.current) {
            const mesh = focusedMeshRef.current;
            const cap = focusedCapRef.current;

            // Restore default emissive
            if (mesh.material.emissive) {
                const defaultIntensity = isDarkMode ? (mesh.userData.type === 'file' ? 0.6 : 0) : 0;
                const targetColor = mesh.material.color;
                gsap.to(mesh.material.emissive, {
                    r: targetColor.r, g: targetColor.g, b: targetColor.b,
                    duration: 0.5
                });
                mesh.material.emissiveIntensity = defaultIntensity;
            }

            // Restore original positions & rotations
            gsap.to(mesh.position, { y: focusedMeshOrigYRef.current, duration: 0.5, ease: "power2.out" });
            gsap.to(mesh.rotation, { x: 0, z: 0, duration: 0.5, ease: "power2.out" });
            if (cap) {
                gsap.to(cap.position, { y: focusedCapOrigYRef.current, duration: 0.5, ease: "power2.out" });
                gsap.to(cap.rotation, { x: 0, z: 0, duration: 0.5, ease: "power2.out" });
            }

            focusedMeshRef.current = null;
            focusedCapRef.current = null;
        }
        if (searchBeaconRef.current) {
            searchBeaconRef.current.visible = false;
        }
        setIsSearchActive(false);
    };

    const focusOnFile = (filename) => {
        const buildingData = buildingMeshesRef.current.get(filename);
        if (!buildingData || !sceneRef.current) return;

        // Clear previous if any
        clearSearchHighlight();

        const { mesh, cap } = buildingData;
        focusedMeshRef.current = mesh;
        focusedCapRef.current = cap;
        focusedMeshOrigYRef.current = mesh.position.y;
        focusedCapOrigYRef.current = cap.position.y;

        const targetPos = new THREE.Vector3();
        cap.getWorldPosition(targetPos);

        // 1. Visual Highlight Pulse & Bounce/Shake (Infinite)
        highlightTimelineRef.current = gsap.timeline({ repeat: -1 });

        // Emissive Pulse
        highlightTimelineRef.current.to(mesh.material.emissive, {
            r: 1, g: 1, b: 1, duration: 0.8, yoyo: true, repeat: -1, ease: "sine.inOut"
        }, 0);

        // Bouncing Animation
        const bounceDist = 10;
        highlightTimelineRef.current.to([mesh.position, cap.position], {
            y: (i) => (i === 0 ? focusedMeshOrigYRef.current : focusedCapOrigYRef.current) + bounceDist,
            duration: 0.6,
            yoyo: true,
            repeat: -1,
            ease: "power1.inOut"
        }, 0);

        mesh.material.emissiveIntensity = isDarkMode ? 1.0 : 0.8;

        // 2. Add/Move Beacon Pointer (Beautiful Version)
        if (!searchBeaconRef.current) {
            const group = new THREE.Group();

            // Vertical Glow Beam
            const beamGeo = new THREE.CylinderGeometry(1.5, 1.5, 400, 16);
            const beamMat = new THREE.MeshBasicMaterial({
                color: 0x3b82f6,
                transparent: true,
                opacity: 0.3,
                blending: THREE.AdditiveBlending
            });
            const beam = new THREE.Mesh(beamGeo, beamMat);
            beam.position.y = 200;
            group.add(beam);

            // Inner Core Beam
            const coreGeo = new THREE.CylinderGeometry(0.5, 0.5, 400, 8);
            const coreMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.8
            });
            const core = new THREE.Mesh(coreGeo, coreMat);
            core.position.y = 200;
            group.add(core);

            // Ground Rings
            for (let i = 0; i < 3; i++) {
                const ringGeo = new THREE.TorusGeometry(8 + i * 4, 0.3, 16, 64);
                const ringMat = new THREE.MeshBasicMaterial({
                    color: 0x3b82f6,
                    transparent: true,
                    opacity: 0.5 - (i * 0.1)
                });
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.rotation.x = Math.PI / 2;
                ring.userData = { phase: i * 0.5 };
                group.add(ring);

                gsap.to(ring.scale, {
                    x: 1.2, y: 1.2,
                    duration: 1 + i * 0.2,
                    repeat: -1,
                    yoyo: true,
                    ease: "sine.inOut"
                });
            }

            // Floating Diamond (Top)
            const diamondGeo = new THREE.OctahedronGeometry(6, 0);
            const diamondMat = new THREE.MeshStandardMaterial({
                color: 0x3b82f6,
                emissive: 0x3b82f6,
                emissiveIntensity: 0.8,
                metalness: 0.8,
                roughness: 0.2,
                transparent: true,
                opacity: 0.9
            });
            const diamond = new THREE.Mesh(diamondGeo, diamondMat);
            diamond.position.y = 400;
            group.add(diamond);

            gsap.to(diamond.rotation, {
                y: Math.PI * 2,
                duration: 4,
                repeat: -1,
                ease: "none"
            });
            gsap.to(diamond.position, {
                y: 410,
                duration: 2,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut"
            });

            sceneRef.current.add(group);
            searchBeaconRef.current = group;
        }

        const beacon = searchBeaconRef.current;
        beacon.position.set(targetPos.x, targetPos.y + 10, targetPos.z);
        beacon.visible = true;

        setIsSearchActive(true);
        setSearchTerm('');
        setSearchResults([]);
        setIsSearchFocused(false);
    };



    // --- Main Scene Initialization ---
    useEffect(() => {
        if (!mountRef.current) return;

        // --- Full Scene Rebuild Path ---
        // This runs on first load, when layout needs recalculation (new files added), or config changes
        console.log('[Island3D] Full scene rebuild');

        // --- Layout Calculation with D3 ---
        const hierarchyData = buildHierarchy(individualFiles);
        const root = d3.hierarchy(hierarchyData)
            .sum(d => d.value ? d.value : 0) // Sizing files by LOC (D3 pack uses value for area)
            .sort((a, b) => b.value - a.value);

        // Dynamic Island Sizing uses memoized values

        // Pack the circles
        const packLayout = d3.pack()
            .size([islandSize, islandSize]) // Dynamic workspace size
            .padding(d => d.depth === 0 ? 30 : 20);

        packLayout(root);

        // --- Three.js Setup ---

        // Store pointer lock state before cleanup
        const wasPointerLocked = document.pointerLockElement === mountRef.current;
        searchBeaconRef.current = null; // Reset beacon ref to ensure it's recreated in the new scene

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
        const camera = new THREE.PerspectiveCamera(55, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 3000);

        // Initial position
        if (cameraRef.current) {
            // Restore previous position
            camera.position.copy(cameraRef.current.position);
            camera.quaternion.copy(cameraRef.current.quaternion);
        } else {
            camera.position.set(islandCenterX, islandSize * 0.5, islandCenterZ + islandSize * 0.75);
            camera.lookAt(islandCenterX, 0, islandCenterZ);
        }
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: !isTimelinePlaying, powerPreference: 'high-performance' });
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
        sunLight.position.set(islandCenterX + islandSize * 0.25, 300 + islandSize * 0.25, islandCenterZ + islandSize * 0.25);
        sunLight.castShadow = true;
        // Reduce shadow map resolution during timeline playback for faster rendering
        const shadowMapSize = isTimelinePlaying ? 512 : 4096;
        sunLight.shadow.mapSize.width = shadowMapSize;
        sunLight.shadow.mapSize.height = shadowMapSize;
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 2000;

        // Adjust shadow frustum to cover the whole island
        const shadowSize = islandSize * 0.8;
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

        const renderCircularIsland = (root) => {
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
                    const maintainabilityIndex = node.data.maintainabilityIndex ?? 100;
                    const isUnsupported = node.data.fileData?.is_unsupported;
                    const color = isUnsupported
                        ? (isDarkMode ? 0xcfcfcf : 0x9ca3af) // White in dark mode, Gray for unsupported
                        : getMaintainabilityColor(maintainabilityIndex);
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
                    const parentTopY = (node.depth - 1) * platformHeight;
                    mesh.position.set(x, parentTopY + towerHeight / 2, z);

                    mesh.castShadow = true;
                    mesh.receiveShadow = true;

                    mesh.userData = {
                        type: 'file',
                        name: node.data.name,
                        ...node.data.fileData,
                        depth: node.depth, // Needed for shockwave positioning
                        totalComplexity: complexity.toFixed(2),
                        maintainabilityIndex: node.data.maintainabilityIndex,
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
            renderNode(root);
        };

        const renderTowers = (root, platformHeight) => {
            root.leaves().forEach(leaf => {
                const complexity = leaf.data.totalComplexity || 1;
                const towerHeight = 10 + (Math.sqrt(complexity) * 15);
                const towerRadius = 1.8 + (leaf.r * 0.9);

                const geometry = new THREE.CylinderGeometry(towerRadius, towerRadius, towerHeight, 32);
                const maintainabilityIndex = leaf.data.maintainabilityIndex ?? 100;
                const isUnsupported = leaf.data.fileData?.is_unsupported;
                const color = isUnsupported
                    ? (isDarkMode ? 0xcfcfcf : 0x9ca3af)
                    : getMaintainabilityColor(maintainabilityIndex);

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
                const parentTopY = (leaf.depth) * platformHeight;
                mesh.position.set(leaf.x, parentTopY + towerHeight / 2, leaf.y);

                mesh.castShadow = true;
                mesh.receiveShadow = true;

                mesh.userData = {
                    type: 'file',
                    name: leaf.data.name,
                    ...leaf.data.fileData,
                    depth: leaf.depth,
                    totalComplexity: complexity.toFixed(2),
                    maintainabilityIndex: maintainabilityIndex,
                    totalLoc: leaf.data.totalLoc,
                    numFunctions: leaf.data.numFunctions
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
                cap.position.set(leaf.x, parentTopY + towerHeight + 0.1, leaf.y);
                scene.add(cap);
                geometriesToDispose.push(capGeo);
                materialsToDispose.push(capMat);

                buildingMeshesRef.current.set(leaf.data.fileData.filename, {
                    mesh,
                    cap,
                    data: leaf.data.fileData,
                    height: towerHeight
                });

                if (sceneInitializedRef.current) {
                    animateBuildingFadeIn(mesh, cap, 0.5);
                }
            });
        };

        const renderDecorations = (root) => {
            if (!showDecorations) return;
            const rootChildren = root.children || [];
            rootChildren.forEach(child => {
                const numTrees = 2 + Math.floor(Math.random() * 3);
                for (let i = 0; i < numTrees; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * (child.r - 2);
                    const tx = child.x + Math.cos(angle) * dist;
                    const tz = child.y + Math.sin(angle) * dist;

                    const trunkH = 4 + Math.random() * 2;
                    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, trunkH, 8);
                    const trunkMat = new THREE.MeshStandardMaterial({ color: isDarkMode ? 0x57534e : 0x8b5a2b });
                    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                    trunk.position.set(tx, trunkH / 2, tz);
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
                    foliage.position.set(tx, trunkH + 1, tz);
                    scene.add(foliage);
                    geometriesToDispose.push(leafGeo);
                    materialsToDispose.push(leafMat);
                }
            });
        };

        const renderFreeForm = (root) => {
            const platformHeight = 3;

            // 1. Render Platforms (Directories) recursively to handle stacking
            const renderDirectory = (node) => {
                if (!node.children || node.children.length === 0) return;

                const color = getDirectoryColor(node.depth);
                const totalDepthHeight = (node.depth + 1) * platformHeight;

                const extrudeSettings = {
                    depth: totalDepthHeight,
                    bevelEnabled: true,
                    bevelThickness: 0.5,
                    bevelSize: 0.5,
                    bevelSegments: 5
                };

                const renderShape = (nodes, pad) => {
                    const organicData = getOrganicShape(nodes, pad);
                    if (!organicData) return;

                    const geometry = new THREE.ExtrudeGeometry(organicData.shape, extrudeSettings);
                    geometry.rotateX(Math.PI / 2);

                    const material = new THREE.MeshStandardMaterial({
                        color: color,
                        roughness: 0.8,
                        metalness: 0.2,
                        emissive: color,
                        emissiveIntensity: 0
                    });

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.y = totalDepthHeight;
                    mesh.receiveShadow = true;
                    mesh.castShadow = true;

                    mesh.userData = {
                        type: 'directory',
                        name: node.data.name,
                        path: node.ancestors().map(n => n.data.name).reverse().join('/'),
                        depth: node.depth,
                        node: node
                    };

                    scene.add(mesh);
                    interactableMeshes.push(mesh);
                    geometriesToDispose.push(geometry);
                    materialsToDispose.push(material);

                    // Add border ring for definition
                    const ringGeo = new THREE.TorusGeometry(node.r + 0.2, 0.3, 8, 64);
                    // The boundary of freeform is hard to outline securely with torus, so we'll skip the ring or apply at nodes lightly if we wanted, but we leave it to pure shape extrusion for simplicity without math-heavy edge outlining. 
                    // To keep aesthetic we'll skip torus for freeform bases to let the bevel do the work.
                    geometriesToDispose.push(ringGeo);
                };

                // For root (depth 0), render all child clusters as one combined platform
                if (node.depth === 0) {
                    renderShape(node.children, 15);
                } else {
                    renderShape(node.children, 8);
                }

                // Recurse to children
                node.children.forEach(child => {
                    if (child.children) renderDirectory(child);
                });
            };

            renderDirectory(root);
            renderTowers(root, platformHeight);
            renderDecorations(root);
        };

        const renderHoneycomb = (root) => {
            const platformHeight = 3;
            const hexGeometry = new THREE.CylinderGeometry(HEX_RADIUS - HEX_MARGIN, HEX_RADIUS - HEX_MARGIN, HEX_HEIGHT, 6);
            hexGeometry.rotateY(Math.PI / 6);
            geometriesToDispose.push(hexGeometry);

            // 1. Flatten sampling: Create a map of hexKey -> deepestNode
            const hexToNodeMap = new Map();
            const padding = 8; // Tighter padding for directory platforms
            const rootPadding = 15;

            const processNode = (node) => {
                if (!node.children || node.children.length === 0) return;

                const populateHexes = (nodes, pad) => {
                    const organicData = getOrganicShape(nodes, pad);
                    if (!organicData) return;

                    const minX = Math.min(...organicData.bezierPoints.map(p => p.x)) - HEX_RADIUS * 2;
                    const maxX = Math.max(...organicData.bezierPoints.map(p => p.x)) + HEX_RADIUS * 2;
                    const minZ = Math.min(...organicData.bezierPoints.map(p => p.y)) - HEX_RADIUS * 2;
                    const maxZ = Math.max(...organicData.bezierPoints.map(p => p.y)) + HEX_RADIUS * 2;

                    const qMin = Math.floor((Math.sqrt(3) / 3 * minX - 1 / 3 * maxZ) / HEX_RADIUS) - 1;
                    const qMax = Math.ceil((Math.sqrt(3) / 3 * maxX - 1 / 3 * minZ) / HEX_RADIUS) + 1;
                    const rMin = Math.floor((2 / 3 * minZ) / HEX_RADIUS) - 1;
                    const rMax = Math.ceil((2 / 3 * maxZ) / HEX_RADIUS) + 1;

                    for (let q = qMin; q <= qMax; q++) {
                        for (let r = rMin; r <= rMax; r++) {
                            const pos = axialToPixel(q, r);
                            if (isPointInShape(pos.x, pos.z, organicData.bezierPoints)) {
                                const key = `${q},${r}`;
                                const existing = hexToNodeMap.get(key);
                                // Always prioritize deeper nodes, but for depth 0, we are filling the base
                                if (!existing || node.depth > existing.depth) {
                                    hexToNodeMap.set(key, node);
                                }
                            }
                        }
                    }
                };

                // For root (depth 0), process each child individually to preserve the organic "waist"
                if (node.depth === 0) {
                    node.children.forEach(child => {
                        populateHexes([child], rootPadding);
                    });
                } else {
                    populateHexes(node.children, padding);
                }

                node.children.forEach(child => {
                    if (child.children) processNode(child);
                });
            };

            processNode(root);

            // 2. Group instances by (nodePath, depth)
            const instanceGroups = new Map();
            hexToNodeMap.forEach((deepestNode, key) => {
                const [q, r] = key.split(',').map(Number);
                const pos = axialToPixel(q, r);
                for (let d = 0; d <= deepestNode.depth; d++) {
                    const nodeAtDepth = deepestNode.ancestors().find(a => a.depth === d) || deepestNode;
                    const nodePath = nodeAtDepth.ancestors().map(n => n.data.name).reverse().join('/') || 'root';
                    const groupKey = `${nodePath}_${d}`;
                    if (!instanceGroups.has(groupKey)) {
                        instanceGroups.set(groupKey, { node: nodeAtDepth, depth: d, positions: [] });
                    }
                    instanceGroups.get(groupKey).positions.push(pos);
                }
            });

            // 3. Render InstancedMeshes
            const tempMatrix = new THREE.Matrix4();
            instanceGroups.forEach((group) => {
                const { node, depth, positions } = group;
                const color = getDirectoryColor(depth);
                const material = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.2 });
                const iMesh = new THREE.InstancedMesh(hexGeometry, material, positions.length);
                const baseY = depth * platformHeight;
                positions.forEach((pos, i) => {
                    tempMatrix.setPosition(pos.x, baseY - HEX_HEIGHT / 2, pos.z);
                    iMesh.setMatrixAt(i, tempMatrix);
                });
                iMesh.receiveShadow = true;
                iMesh.castShadow = true;
                iMesh.userData = {
                    type: 'directory',
                    name: node.data.name,
                    path: node.ancestors().map(n => n.data.name).reverse().join('/'),
                    depth: depth,
                    node: node,
                    isInstanced: true
                };
                scene.add(iMesh);
                interactableMeshes.push(iMesh);
                materialsToDispose.push(material);
            });

            renderTowers(root, platformHeight);
            renderDecorations(root);
        };

        if (viewMode === 'island') {
            if (individualFiles.length > 0) {
                if (vizStyle === 'freeform') {
                    renderFreeForm(root);
                } else if (vizStyle === 'honeycomb') {
                    renderHoneycomb(root);
                } else {
                    renderCircularIsland(root);
                }
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

            // Contributor drones are now created dynamically via createDrone during timeline playback
            contributorDronesRef.current.forEach(drone => {
                scene.add(drone.group);
            });
        } else if (viewMode === 'functions' && focusedFile) {
            // --- Function Visualization (Satellites) ---

            // Central Core (File)
            const coreRadius = 20;
            const coreGeo = new THREE.SphereGeometry(coreRadius, 64, 64);
            const coreColor = getMaintainabilityColor(focusedFile.maintainabilityIndex);
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

            // Ocean animation — skip during timeline playback (10k vertex CPU update per frame)
            if (!isTimelinePlayingRef.current) {
                for (let i = 0; i < oceanVertices.count; i++) {
                    const z = originalPositions[i];
                    const x = oceanVertices.getX(i);
                    const y = oceanVertices.getY(i);
                    const wave = Math.sin(x * 0.03 + time) * 1.0 + Math.cos(y * 0.03 + time * 0.8) * 1.0;
                    oceanVertices.setZ(i, z + wave);
                }
                oceanVertices.needsUpdate = true;
            }

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

            // Contributor Drones Animation
            contributorDronesRef.current.forEach(d => {
                d.angle += d.speed;
                d.group.position.x = islandCenterX + Math.cos(d.angle) * d.radius;
                d.group.position.z = islandCenterZ + Math.sin(d.angle) * d.radius;
                d.group.rotation.y = -d.angle + Math.PI / 2;

                // Hover effect (absolute sine to prevent vertical drift)
                const baseHoverY = d.baseY || 120;
                d.group.position.y = baseHoverY + Math.sin(time * 2 + d.angle) * 2;
            });

            // Camera Movement
            const euler = new THREE.Euler(pitchRef.current, yawRef.current, 0, 'YXZ');
            camera.quaternion.setFromEuler(euler);

            const keys = keysRef.current;
            const moveVec = new THREE.Vector3();

            // Only move if search is not focused
            if (!searchFocusedRef.current) {
                if (keys['w']) moveVec.z -= moveSpeed * 2;
                if (keys['s']) moveVec.z += moveSpeed * 2;
                if (keys['a']) moveVec.x -= moveSpeed * 2;
                if (keys['d']) moveVec.x += moveSpeed * 2;
                if (keys['q']) moveVec.y += moveSpeed * 2;
                if (keys['e']) moveVec.y -= moveSpeed * 2;
            }

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

        // Mark scene as initialized for future incremental updates
        // IMPORTANT: Must be BEFORE the return() cleanup, or React will never execute these lines.
        sceneInitializedRef.current = true;
        previousFilesRef.current = individualFiles;

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

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rebuildTrigger, onFunctionClick, minComplexity, maxComplexity, isDarkMode, viewMode, focusedFile, towerOpacity, showDecorations, vizStyle]);

    // --- Timeline Animation Side Effect ---
    useEffect(() => {
        if (!isTimelinePlaying || !animatingCommit || !sceneRef.current) return;
        if (lastProcessedCommitRef.current === animatingCommit.hash) return;

        const author = animatingCommit.author;

        // Use files detected by SceneDiffer in the main effect, fall back to `files_changed` if available
        const modifiedFiles = pendingStrikeFilesRef.current.length > 0
            ? pendingStrikeFilesRef.current
            : (animatingCommit.files_changed?.map(f => f.filename) || []);

        console.log(`[Island3D] Triggering strike for ${author} on files: [${modifiedFiles.join(', ')}] (commit: ${animatingCommit.hash?.substring(0, 7)})`);

        if (showContributors) {
            // Warm up / ensure drone for current author
            createDrone(author, sceneRef.current, 200, 200);

            // Fire lasers with a small delay to ensure scene is ready
            if (modifiedFiles.length > 0) {
                setTimeout(() => {
                    triggerLaserStrike(author, modifiedFiles, sceneRef.current);
                    // Clear pending after firing
                    pendingStrikeFilesRef.current = [];
                }, 100);
            } else {
                console.warn(`[Island3D] No files to target for commit ${animatingCommit.hash?.substring(0, 7)}`);
            }
        } else {
            // If feature is disabled, simply clear the pending buffer
            pendingStrikeFilesRef.current = [];
        }

        lastProcessedCommitRef.current = animatingCommit.hash;
    }, [animatingCommit, isTimelinePlaying, showContributors]);

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

    // --- Cleanup Drones on Timeline Stop or Toggle Off ---
    useEffect(() => {
        if ((!isTimelinePlaying || !showContributors) && sceneRef.current) {
            // Fade out and remove all drones dynamically
            contributorDronesRef.current.forEach((droneData, author) => {
                const { group } = droneData;
                gsap.to(group.scale, {
                    x: 0, y: 0, z: 0,
                    duration: 0.8,
                    ease: "back.in(1.5)",
                    onComplete: () => {
                        sceneRef.current.remove(group);
                        // Optional cleanup
                        group.traverse((child) => {
                            if (child.isMesh || child.isSprite) {
                                if (child.geometry) child.geometry.dispose();
                                if (child.material) child.material.dispose();
                            }
                        });
                    }
                });
            });
            contributorDronesRef.current.clear();
            pendingStrikeFilesRef.current = [];
            lastProcessedCommitRef.current = null;
        }
    }, [isTimelinePlaying, showContributors]);

    // If in functions mode, render the separate component
    if (viewMode === 'functions' && focusedFile) {
        return (
            <FunctionTableView
                file={focusedFile}
                isDarkMode={isDarkMode}
                onFunctionClick={onFunctionClick}
                onFileClick={onFileClick}
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
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `#${getMaintainabilityColor(hoveredObject.type === 'function' ? (hoveredObject.complexity * 5) : hoveredObject.maintainabilityIndex).toString(16).padStart(6, '0')}` }} />
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
                                            <span>Maintainability Index:</span>
                                            <span className="font-medium text-gray-900">{hoveredObject.maintainabilityIndex?.toFixed(2)}</span>
                                        </div>
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

                        {/* Visualization Style Selector */}
                        <div className="mb-4">
                            <label className={`text-xs mb-1 block ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                Platform Style
                            </label>
                            <div className="flex bg-gray-200 dark:bg-slate-700 rounded-lg p-1 gap-1">
                                {['circular', 'honeycomb', 'freeform'].map(style => (
                                    <button
                                        key={style}
                                        onClick={() => setVizStyle(style)}
                                        className={`flex-1 text-[10px] py-1.5 rounded-md font-medium transition-colors ${
                                            vizStyle === style
                                                ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                        }`}
                                    >
                                        {style.charAt(0).toUpperCase() + style.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
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

            {/* Search Bar - Moved to top-left to avoid overlap with the "Type" panel toggle */}
            <div className="absolute top-6 left-20 z-[25] w-full max-w-sm px-4 flex items-center gap-3">
                <div className={`relative flex-1 flex items-center backdrop-blur-xl border shadow-2xl rounded-2xl transition-all duration-300 ${isSearchFocused
                    ? 'ring-2 ring-blue-500/50 border-blue-400/50 bg-white/20 dark:bg-black/40'
                    : 'border-white/20 bg-white/10 dark:bg-black/20 hover:bg-white/15 dark:hover:bg-black/25'
                    }`}>
                    <div className="pl-4 text-white/50">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search file name..."
                        value={searchTerm}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm font-medium py-3 px-3"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => { setSearchTerm(''); setSearchResults([]); }}
                            className="pr-4 text-gray-400 hover:text-gray-100 transition-colors"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    )}
                </div>

                {/* OK Button to dismiss highight */}
                {isSearchActive && (
                    <button
                        onClick={clearSearchHighlight}
                        className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl shadow-lg font-bold text-sm transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 animate-in zoom-in duration-300"
                    >
                        <span>OK</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </button>
                )}

                {/* Search Results Dropdown */}

                {searchResults.length > 0 && isSearchFocused && (
                    <div className="absolute top-full left-4 right-4 mt-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 dark:border-slate-800/50 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                        {searchResults.map((result, idx) => (
                            <button
                                key={idx}
                                onClick={() => focusOnFile(result.filename)}
                                className="w-full text-left px-4 py-3 hover:bg-blue-500/10 dark:hover:bg-blue-400/10 border-b border-gray-100/50 dark:border-slate-800/30 last:border-0 transition-colors group"
                            >
                                <div className="text-sm font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-500 transition-colors">
                                    {result.name}
                                </div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate opacity-70">
                                    {result.filename}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom-left UI Stack */}
            <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-4">
                {/* Controls Help */}
                <div className={`backdrop-blur-md rounded-xl shadow-lg p-4 border ${isDarkMode
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

                {/* Legend (Terraced Map Info) */}
                <div className={`backdrop-blur-md rounded-xl shadow-lg p-4 border ${isDarkMode
                    ? 'bg-slate-800/80 border-slate-700/50'
                    : 'bg-white/80 border-white/50'}`}>
                    <h4 className={`font-bold text-sm mb-3 flex items-center gap-2 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                        Terraced Map
                    </h4>
                    <div className={`space-y-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-[#f5d5a8] rounded-sm" />
                            <span>Platform = Directory</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-3 bg-emerald-500 rounded-sm mx-1" />
                            <span>Tower = File</span>
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between font-bold mb-1">
                                <span>Maintainability</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: isDarkMode ? '#ef4444' : '#ef4444' }} />
                                <span>0-9 (Poor)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: isDarkMode ? '#ec4899' : '#f97316' }} />
                                <span>10-14 (Moderate)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: isDarkMode ? '#a855f7' : '#facc15' }} />
                                <span>15-19 (Good)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: isDarkMode ? '#06b6d4' : '#22c55e' }} />
                                <span>20-100 (Excellent)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}

export default Island3DVisualization;
