import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

function CodeCity3DVisualization({ individualFiles, onFunctionClick }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const animationIdRef = useRef(null);
  const cameraRef = useRef(null);
  
  const [hoveredBlock, setHoveredBlock] = useState(null);
  const [hoverInfoPosition, setHoverInfoPosition] = useState({ x: 0, y: 0 });
  const [timeOfDay, setTimeOfDay] = useState('sunset');
  
  const keysRef = useRef({});
  const moveSpeed = 0.5;

  if (!individualFiles || individualFiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No files to visualize
      </div>
    );
  }

  const allComplexities = [];
  individualFiles.forEach(file => {
    const functions = file.functions || [];
    functions.forEach(fn => {
      if (fn.cyclomatic_complexity !== undefined && fn.cyclomatic_complexity !== null) {
        allComplexities.push(fn.cyclomatic_complexity);
      }
    });
  });

  const minComplexity = allComplexities.length > 0 ? Math.min(...allComplexities) : 1;
  const maxComplexity = allComplexities.length > 0 ? Math.max(...allComplexities) : 10;

  const getComplexityColor = (complexity) => {
    if (complexity === undefined || complexity === null) {
      return 0x9ca3af;
    }
    if (maxComplexity === minComplexity) {
      return 0x22c55e;
    }
    const normalized = (complexity - minComplexity) / (maxComplexity - minComplexity);
    const red = Math.round(34 + normalized * 221);
    const green = Math.round(197 - normalized * 175);
    const blue = Math.round(34 - normalized * 12);
    return (red << 16) | (green << 8) | blue;
  };

  const maxNloc = Math.max(
    ...individualFiles.flatMap(file => 
      (file.functions || []).map(fn => fn.nloc || 0)
    ),
    1
  );

  useEffect(() => {
    if (!mountRef.current) return;

    if (mountRef.current.hasChildNodes()) {
      while (mountRef.current.firstChild) {
        mountRef.current.removeChild(mountRef.current.firstChild);
      }
    }

    const gridSize = Math.ceil(Math.sqrt(individualFiles.length));
    const spacing = 20;
    const buildings = [];
    
    individualFiles.forEach((file, fileIdx) => {
      const functions = file.functions || [];
      if (functions.length === 0) return;
      
      const row = Math.floor(fileIdx / gridSize);
      const col = fileIdx % gridSize;
      const x = (col - gridSize / 2) * spacing;
      const z = (row - gridSize / 2) * spacing;
      
      const baseSize = Math.max(4, Math.min(12, 4 + functions.length * 0.5));
      
      const blocks = functions.map((fn, fnIdx) => {
        const complexity = fn.cyclomatic_complexity;
        const nloc = fn.nloc || 1;
        const height = Math.max(5, (nloc / maxNloc) * 50);
        
        return {
          functionName: fn.name || 'Unknown',
          filename: file.filename,
          startLine: fn.start_line,
          nloc: nloc,
          complexity: complexity,
          height: height,
          color: getComplexityColor(complexity),
          blockIndex: fnIdx
        };
      });
      
      buildings.push({
        name: file.filename?.split('/').pop() || `File ${fileIdx + 1}`,
        filename: file.filename,
        x: x,
        z: z,
        baseSize: baseSize,
        blocks: blocks
      });
    });

    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    buildings.forEach(b => {
      minX = Math.min(minX, b.x - b.baseSize / 2);
      maxX = Math.max(maxX, b.x + b.baseSize / 2);
      minZ = Math.min(minZ, b.z - b.baseSize / 2);
      maxZ = Math.max(maxZ, b.z + b.baseSize / 2);
    });

    const margin = 10;
    const platformCenterX = (minX + maxX) / 2;
    const platformCenterZ = (minZ + maxZ) / 2;
    const platformSize = Math.max((maxX - minX) + margin * 2, (maxZ - minZ) + margin * 2);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    const skySettings = {
      day: {
        skyTop: '#87CEEB',
        skyMiddle: '#B0E0E6',
        skyBottom: '#E0F6FF',
        fogColor: 0x87CEEB,
        ambientColor: 0xffffff,
        ambientIntensity: 0.8,
        sunColor: 0xffffff,
        sunIntensity: 1.5,
        sunPosition: [50, 80, 50],
        fillColor: 0x87CEEB,
        fillIntensity: 0.3
      },
      sunset: {
        skyTop: '#1e3a8a',
        skyMiddle: '#f59e0b',
        skyBottom: '#fbbf24',
        fogColor: 0xf59e0b,
        ambientColor: 0xffa07a,
        ambientIntensity: 0.5,
        sunColor: 0xffd700,
        sunIntensity: 1.2,
        sunPosition: [-100, 40, -100],
        fillColor: 0xff6347,
        fillIntensity: 0.4
      },
      night: {
        skyTop: '#0a0a2e',
        skyMiddle: '#16213e',
        skyBottom: '#1a1a3e',
        fogColor: 0x0a0a2e,
        ambientColor: 0x4a5f8f,
        ambientIntensity: 0.3,
        sunColor: 0xaaaaff,
        sunIntensity: 0.5,
        sunPosition: [0, 50, 0],
        fillColor: 0x6666ff,
        fillIntensity: 0.2
      }
    };

    const currentSettings = skySettings[timeOfDay];
    
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, currentSettings.skyTop);
    gradient.addColorStop(0.5, currentSettings.skyMiddle);
    gradient.addColorStop(1, currentSettings.skyBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 2, 256);
    
    const texture = new THREE.CanvasTexture(canvas);
    scene.background = texture;
    scene.fog = new THREE.Fog(currentSettings.fogColor, 100, 400);

    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    const cameraDistance = platformSize * 0.5;
    camera.position.set(cameraDistance, cameraDistance * 0.05, cameraDistance);
    camera.lookAt(platformCenterX, 0, platformCenterZ);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(currentSettings.ambientColor, currentSettings.ambientIntensity);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(currentSettings.sunColor, currentSettings.sunIntensity);
    sunLight.position.set(...currentSettings.sunPosition);
    sunLight.castShadow = true;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(currentSettings.fillColor, currentSettings.fillIntensity);
    fillLight.position.set(50, 20, 50);
    scene.add(fillLight);

    const stars = [];
    if (timeOfDay === 'night') {
      const starGeometry = new THREE.SphereGeometry(0.5, 8, 8);
      const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      
      for (let i = 0; i < 200; i++) {
        const star = new THREE.Mesh(starGeometry, starMaterial);
        star.position.set(
          (Math.random() - 0.5) * 500,
          Math.random() * 200 + 100,
          (Math.random() - 0.5) * 500
        );
        scene.add(star);
        stars.push(star);
      }
    }

    const oceanColor = timeOfDay === 'night' ? 0x0a2463 : timeOfDay === 'day' ? 0x1e88e5 : 0x1e88e5;
    const oceanGeometry = new THREE.PlaneGeometry(platformSize * 3, platformSize * 3, 100, 100);
    const oceanMaterial = new THREE.MeshStandardMaterial({
      color: oceanColor,
      roughness: 0.3,
      metalness: 0.8,
      transparent: true,
      opacity: 0.9
    });
    const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -2;
    scene.add(ocean);
    
    const oceanVertices = oceanGeometry.attributes.position;
    const originalPositions = [];
    for (let i = 0; i < oceanVertices.count; i++) {
      originalPositions.push(oceanVertices.getZ(i));
    }

    const boundaryBoxWidth = (maxX - minX) + 10;
    const boundaryBoxDepth = (maxZ - minZ) + 10;
    const islandGeometry = new THREE.BoxGeometry(boundaryBoxWidth + 10, 3, boundaryBoxDepth + 10);
    const islandMaterial = new THREE.MeshStandardMaterial({
      color: 0xdaa520,
      roughness: 0.9,
      metalness: 0.1
    });
    const island = new THREE.Mesh(islandGeometry, islandMaterial);
    island.position.set(platformCenterX, -0.5, platformCenterZ);
    island.receiveShadow = true;
    scene.add(island);

    const beachGridHelper = new THREE.GridHelper(platformSize * 1.5, 30, 0xf4a460, 0xe6b87d);
    beachGridHelper.position.y = 0.01;
    beachGridHelper.material.opacity = 0.3;
    beachGridHelper.material.transparent = true;
    scene.add(beachGridHelper);

    const blockMeshes = [];
    const geometriesToDispose = [];
    const materialsToDispose = [];
    const palmTrees = [];
    const dolphins = [];
    const boats = [];

    const numPalmTrees = 12;
    for (let i = 0; i < numPalmTrees; i++) {
      const angle = (i / numPalmTrees) * Math.PI * 2;
      const radius = Math.max(boundaryBoxWidth, boundaryBoxDepth) / 2 + 3;
      const x = platformCenterX + Math.cos(angle) * radius;
      const z = platformCenterZ + Math.sin(angle) * radius;
      
      const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 8, 8);
      const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.set(x, 4, z);
      scene.add(trunk);
      palmTrees.push(trunk);
      geometriesToDispose.push(trunkGeometry);
      materialsToDispose.push(trunkMaterial);
      
      for (let j = 0; j < 6; j++) {
        const leafAngle = (j / 6) * Math.PI * 2;
        const leafGeometry = new THREE.ConeGeometry(1.5, 4, 4);
        const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.7 });
        const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
        leaf.position.set(
          x + Math.cos(leafAngle) * 1.5,
          8.5,
          z + Math.sin(leafAngle) * 1.5
        );
        leaf.rotation.z = Math.cos(leafAngle) * 0.5;
        leaf.rotation.x = Math.sin(leafAngle) * 0.5;
        scene.add(leaf);
        palmTrees.push(leaf);
        geometriesToDispose.push(leafGeometry);
        materialsToDispose.push(leafMaterial);
      }
    }

    const numFlowers = 40;
    for (let i = 0; i < numFlowers; i++) {
      const t = i / numFlowers;
      let x, z;
      
      if (t < 0.25) {
        x = minX + (t * 4) * (maxX - minX);
        z = minZ;
      } else if (t < 0.5) {
        x = maxX;
        z = minZ + ((t - 0.25) * 4) * (maxZ - minZ);
      } else if (t < 0.75) {
        x = maxX - ((t - 0.5) * 4) * (maxX - minX);
        z = maxZ;
      } else {
        x = minX;
        z = maxZ - ((t - 0.75) * 4) * (maxZ - minZ);
      }
      
      const flowerGeometry = new THREE.SphereGeometry(0.3, 8, 8);
      const flowerMaterial = new THREE.MeshStandardMaterial({ 
        color: Math.random() > 0.5 ? 0xff1493 : 0xff69b4,
        emissive: 0xff1493,
        emissiveIntensity: 0.2
      });
      const flower = new THREE.Mesh(flowerGeometry, flowerMaterial);
      flower.position.set(x, 0.3, z);
      scene.add(flower);
      geometriesToDispose.push(flowerGeometry);
      materialsToDispose.push(flowerMaterial);
    }

    const numShells = 20;
    for (let i = 0; i < numShells; i++) {
      const angle = (i / numShells) * Math.PI * 2;
      const radius = Math.max(boundaryBoxWidth, boundaryBoxDepth) / 2 + 1.5;
      const x = platformCenterX + Math.cos(angle) * radius + (Math.random() - 0.5) * 2;
      const z = platformCenterZ + Math.sin(angle) * radius + (Math.random() - 0.5) * 2;
      
      const shellGeometry = new THREE.ConeGeometry(0.2, 0.3, 6);
      const shellMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xfff5ee,
        roughness: 0.8
      });
      const shell = new THREE.Mesh(shellGeometry, shellMaterial);
      shell.position.set(x, 0.15, z);
      shell.rotation.x = Math.PI / 2;
      shell.rotation.z = Math.random() * Math.PI * 2;
      scene.add(shell);
      geometriesToDispose.push(shellGeometry);
      materialsToDispose.push(shellMaterial);
    }

    const numUmbrellas = 6;
    for (let i = 0; i < numUmbrellas; i++) {
      const angle = (i / numUmbrellas) * Math.PI * 2 + Math.PI / 4;
      const radius = Math.max(boundaryBoxWidth, boundaryBoxDepth) / 2 + 2;
      const x = platformCenterX + Math.cos(angle) * radius;
      const z = platformCenterZ + Math.sin(angle) * radius;
      
      const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 3, 8);
      const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x8b7355 });
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.set(x, 1.5, z);
      scene.add(pole);
      geometriesToDispose.push(poleGeometry);
      materialsToDispose.push(poleMaterial);
      
      const umbrellaGeometry = new THREE.ConeGeometry(1.2, 1.5, 8);
      const umbrellaColors = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3];
      const umbrellaMaterial = new THREE.MeshStandardMaterial({ 
        color: umbrellaColors[i % umbrellaColors.length]
      });
      const umbrella = new THREE.Mesh(umbrellaGeometry, umbrellaMaterial);
      umbrella.position.set(x, 3.5, z);
      scene.add(umbrella);
      geometriesToDispose.push(umbrellaGeometry);
      materialsToDispose.push(umbrellaMaterial);
      
      const chairGeometry = new THREE.BoxGeometry(0.8, 0.1, 1);
      const chairMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const chair = new THREE.Mesh(chairGeometry, chairMaterial);
      chair.position.set(x + 0.5, 0.3, z);
      chair.rotation.y = angle;
      scene.add(chair);
      geometriesToDispose.push(chairGeometry);
      materialsToDispose.push(chairMaterial);
    }

    const numDolphins = 3;
    for (let i = 0; i < numDolphins; i++) {
      const dolphinGeometry = new THREE.SphereGeometry(0.8, 8, 8);
      const dolphinMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4a90e2,
        metalness: 0.3,
        roughness: 0.7
      });
      const dolphin = new THREE.Mesh(dolphinGeometry, dolphinMaterial);
      
      const angle = (i / numDolphins) * Math.PI * 2;
      const radius = platformSize * 1.2;
      dolphin.position.set(
        platformCenterX + Math.cos(angle) * radius,
        -1.5,
        platformCenterZ + Math.sin(angle) * radius
      );
      dolphin.scale.set(1, 0.6, 1.5);
      
      scene.add(dolphin);
      dolphins.push({ mesh: dolphin, angle: angle, phase: i * 2 });
      geometriesToDispose.push(dolphinGeometry);
      materialsToDispose.push(dolphinMaterial);
    }

    const numBoats = 4;
    for (let i = 0; i < numBoats; i++) {
      const boatGroup = new THREE.Group();
      
      const hullGeometry = new THREE.BoxGeometry(2, 0.5, 4);
      const hullMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
      const hull = new THREE.Mesh(hullGeometry, hullMaterial);
      hull.position.y = 0;
      boatGroup.add(hull);
      geometriesToDispose.push(hullGeometry);
      materialsToDispose.push(hullMaterial);
      
      const mastGeometry = new THREE.CylinderGeometry(0.1, 0.1, 4, 8);
      const mastMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const mast = new THREE.Mesh(mastGeometry, mastMaterial);
      mast.position.y = 2;
      boatGroup.add(mast);
      geometriesToDispose.push(mastGeometry);
      materialsToDispose.push(mastMaterial);
      
      const sailGeometry = new THREE.PlaneGeometry(1.5, 3);
      const sailColors = [0xff6b6b, 0xffffff, 0x4ecdc4, 0xffe66d];
      const sailMaterial = new THREE.MeshStandardMaterial({ 
        color: sailColors[i % sailColors.length],
        side: THREE.DoubleSide
      });
      const sail = new THREE.Mesh(sailGeometry, sailMaterial);
      sail.position.set(0.7, 2, 0);
      boatGroup.add(sail);
      geometriesToDispose.push(sailGeometry);
      materialsToDispose.push(sailMaterial);
      
      const angle = (i / numBoats) * Math.PI * 2;
      const radius = platformSize * 1.5;
      boatGroup.position.set(
        platformCenterX + Math.cos(angle) * radius,
        -1.5,
        platformCenterZ + Math.sin(angle) * radius
      );
      boatGroup.rotation.y = angle + Math.PI / 2;
      
      scene.add(boatGroup);
      boats.push({ group: boatGroup, angle: angle, radius: radius });
    }

    const lighthouseX = platformCenterX + Math.max(boundaryBoxWidth, boundaryBoxDepth) / 2 + 5;
    const lighthouseZ = platformCenterZ + Math.max(boundaryBoxWidth, boundaryBoxDepth) / 2 + 5;
    
    const baseGeometry = new THREE.CylinderGeometry(1.5, 2, 3, 8);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.set(lighthouseX, 1.5, lighthouseZ);
    scene.add(base);
    geometriesToDispose.push(baseGeometry);
    materialsToDispose.push(baseMaterial);
    
    const towerGeometry = new THREE.CylinderGeometry(1, 1.2, 12, 8);
    const towerMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xff6347,
      roughness: 0.7
    });
    const tower = new THREE.Mesh(towerGeometry, towerMaterial);
    tower.position.set(lighthouseX, 9, lighthouseZ);
    scene.add(tower);
    geometriesToDispose.push(towerGeometry);
    materialsToDispose.push(towerMaterial);
    
    const lightGeometry = new THREE.CylinderGeometry(1.2, 1.2, 2, 8);
    const lightMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: timeOfDay === 'night' ? 1 : 0.3
    });
    const lighthouseLight = new THREE.Mesh(lightGeometry, lightMaterial);
    lighthouseLight.position.set(lighthouseX, 16, lighthouseZ);
    scene.add(lighthouseLight);
    geometriesToDispose.push(lightGeometry);
    materialsToDispose.push(lightMaterial);
    
    const beaconLight = new THREE.SpotLight(0xffff00, timeOfDay === 'night' ? 2 : 0.5, 100, Math.PI / 6);
    beaconLight.position.set(lighthouseX, 16, lighthouseZ);
    beaconLight.target.position.set(lighthouseX + 50, 0, lighthouseZ);
    scene.add(beaconLight);
    scene.add(beaconLight.target);

    buildings.forEach((building) => {
      let currentHeight = 0;
      const numBlocks = building.blocks.length;
      const sizeReductionPerStep = (building.baseSize * 0.3) / numBlocks;
      const minBlockSize = building.baseSize * 0.4;

      building.blocks.forEach((block, blockIndex) => {
        let blockWidth, blockDepth;
        
        if (blockIndex === 0) {
          blockWidth = building.baseSize;
          blockDepth = building.baseSize;
        } else {
          blockWidth = building.baseSize - (blockIndex * sizeReductionPerStep);
          blockDepth = building.baseSize - (blockIndex * sizeReductionPerStep);
        }

        blockWidth = Math.max(blockWidth, minBlockSize);
        blockDepth = Math.max(blockDepth, minBlockSize);

        const geometry = new THREE.BoxGeometry(blockWidth, block.height, blockDepth);
        
        const material = new THREE.MeshStandardMaterial({
          color: block.color,
          roughness: 0.2,
          metalness: 0.7,
          emissive: block.color,
          emissiveIntensity: 0.1
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
          building.x,
          currentHeight + block.height / 2,
          building.z
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        mesh.userData = {
          ...block,
          filename: building.filename,
          buildingName: building.name,
          blockIndex: blockIndex,
          totalBlocks: building.blocks.length,
          width: blockWidth,
          depth: blockDepth
        };
        
        scene.add(mesh);
        blockMeshes.push(mesh);
        geometriesToDispose.push(geometry);
        materialsToDispose.push(material);

        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ 
          color: 0xffffff, 
          opacity: 0.6, 
          transparent: true 
        });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        mesh.add(wireframe);
        geometriesToDispose.push(edges);
        materialsToDispose.push(lineMaterial);
        
        currentHeight += block.height;
      });
    });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

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
      const intersects = raycaster.intersectObjects(blockMeshes);

      if (intersects.length > 0 && onFunctionClick && !isMouseLocked) {
        const clickedMesh = intersects[0].object;
        const blockData = clickedMesh.userData;
        
        if (blockData.startLine) {
          onFunctionClick({
            filename: blockData.filename,
            functionName: blockData.functionName,
            startLine: blockData.startLine,
            nloc: blockData.nloc,
            complexity: blockData.complexity
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
        mountRef.current.style.cursor = isMouseLocked ? 'none' : 'crosshair';
      }
    };

    const onMouseMove = (event) => {
      if (!mountRef.current) return;
      
      if (!isMouseLocked) {
        const rect = mountRef.current.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        setHoverInfoPosition({ x: event.clientX + 10, y: event.clientY + 10 });

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(blockMeshes);

        blockMeshes.forEach(mesh => {
          if (mesh.material && !Array.isArray(mesh.material) && mesh.material.emissive) {
            mesh.material.emissive.setHex(0x000000);
          }
        });

        if (intersects.length > 0) {
          const hoveredMesh = intersects[0].object;
          if (hoveredMesh.material && !Array.isArray(hoveredMesh.material) && hoveredMesh.material.emissive) {
            hoveredMesh.material.emissive.setHex(0x444444);
            setHoveredBlock(hoveredMesh.userData);
          }
        } else {
          setHoveredBlock(null);
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
      mountRef.current.style.cursor = 'crosshair';
    }

    let time = 0;
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      time += 0.01;
      
      for (let i = 0; i < oceanVertices.count; i++) {
        const x = oceanVertices.getX(i);
        const y = oceanVertices.getY(i);
        const wave = Math.sin(x * 0.1 + time) * 0.5 + Math.cos(y * 0.1 + time * 0.7) * 0.5;
        oceanVertices.setZ(i, originalPositions[i] + wave);
      }
      oceanVertices.needsUpdate = true;
      
      palmTrees.forEach((tree, i) => {
        if (tree.geometry.type === 'CylinderGeometry') {
          tree.rotation.z = Math.sin(time + i) * 0.05;
        }
      });
      
      dolphins.forEach(dolphin => {
        const jumpHeight = Math.sin(time * 2 + dolphin.phase) * 3;
        dolphin.mesh.position.y = -1.5 + Math.max(0, jumpHeight);
        dolphin.mesh.rotation.x = jumpHeight > 0 ? Math.sin(time * 2 + dolphin.phase) * 0.5 : 0;
      });
      
      boats.forEach(boat => {
        boat.angle += 0.001;
        boat.group.position.x = platformCenterX + Math.cos(boat.angle) * boat.radius;
        boat.group.position.z = platformCenterZ + Math.sin(boat.angle) * boat.radius;
        boat.group.rotation.y = boat.angle + Math.PI / 2;
        boat.group.position.y = -1.5 + Math.sin(time) * 0.2;
      });
      
      if (beaconLight.target) {
        const beaconAngle = time * 0.5;
        beaconLight.target.position.x = lighthouseX + Math.cos(beaconAngle) * 50;
        beaconLight.target.position.z = lighthouseZ + Math.sin(beaconAngle) * 50;
      }
      
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

    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

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

      stars.forEach(star => scene.remove(star));
      geometriesToDispose.forEach(geom => geom.dispose());
      materialsToDispose.forEach(mat => mat.dispose());
      oceanGeometry.dispose();
      oceanMaterial.dispose();
      islandGeometry.dispose();
      islandMaterial.dispose();
      beachGridHelper.geometry.dispose();
      beachGridHelper.material.dispose();

      renderer.dispose();
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
    };
  }, [individualFiles, onFunctionClick, minComplexity, maxComplexity, maxNloc, timeOfDay]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" style={{ minHeight: '55vh' }} />

      {hoveredBlock && (
        <div
          className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-3 pointer-events-none"
          style={{
            left: `${hoverInfoPosition.x + 10}px`,
            top: `${hoverInfoPosition.y - 10}px`,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="text-sm">
            <div className="font-semibold text-gray-900 mb-1">
              {hoveredBlock.functionName}
            </div>
            <div className="text-gray-600">
              <div>File: <span className="font-medium">{hoveredBlock.buildingName}</span></div>
              <div>CC: <span className="font-medium">{hoveredBlock.complexity !== undefined && hoveredBlock.complexity !== null ? hoveredBlock.complexity : 'N/A'}</span></div>
              <div>nloc: <span className="font-medium">{hoveredBlock.nloc}</span></div>
              <div>Block: <span className="font-medium">{hoveredBlock.blockIndex + 1}/{hoveredBlock.totalBlocks}</span></div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-10 border border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={() => setTimeOfDay('day')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              timeOfDay === 'day'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ☀️ Day
          </button>
          <button
            onClick={() => setTimeOfDay('sunset')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              timeOfDay === 'sunset'
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🌅 Sunset
          </button>
          <button
            onClick={() => setTimeOfDay('night')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              timeOfDay === 'night'
                ? 'bg-indigo-900 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🌙 Night
          </button>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 bg-gradient-to-br from-amber-900/90 to-orange-900/90 backdrop-blur-sm rounded-lg shadow-lg p-4 z-10 border border-amber-700">
        <h4 className="font-bold text-sm mb-2 text-amber-100">🎮 Controls</h4>
        <div className="space-y-1 text-xs text-amber-50">
          <div>WASD - Move around</div>
          <div>QE - Up/Down</div>
          <div>ESC - Exit</div>
          <div>click - View code</div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 bg-gradient-to-br from-blue-900/90 to-purple-900/90 backdrop-blur-sm rounded-lg shadow-lg p-4 z-10 border border-blue-700">
        <h4 className="font-bold text-sm mb-2 text-blue-100">🏝️ Island Code City</h4>
        <div className="space-y-1 text-xs text-blue-50">
          <div>🏢 Height = Lines of Code</div>
          <div>📦 Base Size = File Size</div>
          <div>🎨 Color = Complexity</div>
          <div className="mt-2 pt-2 border-t border-blue-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#22c55e' }}></div>
              <span>Low Complexity</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></div>
              <span>High Complexity</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CodeCity3DVisualization;