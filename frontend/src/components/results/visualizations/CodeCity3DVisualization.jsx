import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

function CodeCity3DVisualization({ individualFiles, onFunctionClick }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const animationIdRef = useRef(null);
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  
  const [hoveredBlock, setHoveredBlock] = useState(null);
  const [hoverInfoPosition, setHoverInfoPosition] = useState({ x: 0, y: 0 });
  
  // WASD movement state
  const keysRef = useRef({});
  const moveSpeed = 0.5;
  const rotateSpeed = 0.02;

  if (!individualFiles || individualFiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No files to visualize
      </div>
    );
  }

  // Calculate complexity range for color scaling (same as BarChartVisualization)
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

  // Color scale: green (low) to red (high)
  const getComplexityColor = (complexity) => {
    if (complexity === undefined || complexity === null) {
      return 0x9ca3af; // gray for undefined
    }
    if (maxComplexity === minComplexity) {
      return 0x22c55e; // green if all same
    }
    const normalized = (complexity - minComplexity) / (maxComplexity - minComplexity);
    // Interpolate between green and red
    const red = Math.round(34 + normalized * 221);
    const green = Math.round(197 - normalized * 175);
    const blue = Math.round(34 - normalized * 12);
    return (red << 16) | (green << 8) | blue;
  };

  // Calculate max nloc for scaling block heights
  const maxNloc = Math.max(
    ...individualFiles.flatMap(file => 
      (file.functions || []).map(fn => fn.nloc || 0)
    ),
    1
  );

  useEffect(() => {
    if (!mountRef.current) return;

    // Prevent duplicate scenes
    if (mountRef.current.hasChildNodes()) {
      while (mountRef.current.firstChild) {
        mountRef.current.removeChild(mountRef.current.firstChild);
      }
    }

    // Build buildings data from individualFiles
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
      
      // Calculate base size based on file size or number of functions
      const baseSize = Math.max(4, Math.min(12, 4 + functions.length * 0.5));
      
      // Create blocks for each function
      const blocks = functions.map((fn, fnIdx) => {
        const complexity = fn.cyclomatic_complexity;
        const nloc = fn.nloc || 1;
        const height = Math.max(5, (nloc / maxNloc) * 50); // Scale height based on nloc
        
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

    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    buildings.forEach(b => {
      minX = Math.min(minX, b.x - b.baseSize / 2);
      maxX = Math.max(maxX, b.x + b.baseSize / 2);
      minZ = Math.min(minZ, b.z - b.baseSize / 2);
      maxZ = Math.max(maxZ, b.z + b.baseSize / 2);
    });

    const margin = 10;
    const platformWidth = (maxX - minX) + margin * 2;
    const platformDepth = (maxZ - minZ) + margin * 2;
    const platformCenterX = (minX + maxX) / 2;
    const platformCenterZ = (minZ + maxZ) / 2;
    const platformSize = Math.max(platformWidth, platformDepth);

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f4f8);
    scene.fog = new THREE.Fog(0xf0f4f8, 50, 300);
    sceneRef.current = scene;

    // Camera
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

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // OrbitControls (for mouse interaction, but we'll override with WASD)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enabled = false; // Disable orbit controls, we'll use WASD
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);

    // Platform
    const platformGeometry = new THREE.BoxGeometry(platformWidth, 0.5, platformDepth);
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0xd0e0f0,
      roughness: 0.6,
      metalness: 0.1
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.set(platformCenterX, -0.25, platformCenterZ);
    scene.add(platform);

    // Platform border
    const borderGeometry = new THREE.EdgesGeometry(platformGeometry);
    const borderMaterial = new THREE.LineBasicMaterial({ color: 0x88aacc, linewidth: 2 });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);
    platform.add(border);

    // Grid
    const gridHelper = new THREE.GridHelper(platformSize * 2, platformSize, 0x99bbdd, 0xbbddee);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Green boundary
    const greenBoundaryPadding = 1.0;
    const boundaryBoxWidth = (maxX - minX) + greenBoundaryPadding * 2;
    const boundaryBoxDepth = (maxZ - minZ) + greenBoundaryPadding * 2;
    
    const boundaryGeometry = new THREE.BoxGeometry(boundaryBoxWidth, 0.1, boundaryBoxDepth);
    const boundaryEdges = new THREE.EdgesGeometry(boundaryGeometry);
    const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0x228B22, linewidth: 4 });
    const greenBoundary = new THREE.LineSegments(boundaryEdges, boundaryMaterial);
    greenBoundary.position.set(platformCenterX, 0.05, platformCenterZ);
    scene.add(greenBoundary);

    const blockMeshes = [];
    const geometriesToDispose = [];
    const materialsToDispose = [];

    // Create buildings with stacked blocks
    buildings.forEach((building) => {
      let currentHeight = 0;
      const numBlocks = building.blocks.length;
      
      // Tapering effect: each block is slightly smaller than the one below
      const sizeReductionPerStep = (building.baseSize * 0.3) / numBlocks;
      let currentBaseSize = building.baseSize;
      const minBlockSize = building.baseSize * 0.4;

      building.blocks.forEach((block, blockIndex) => {
        const isTopBlock = blockIndex === building.blocks.length - 1;
        
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

        // Create block geometry
        const geometry = new THREE.BoxGeometry(blockWidth, block.height, blockDepth);
        const material = new THREE.MeshStandardMaterial({
          color: block.color,
          roughness: 0.4,
          metalness: 0.3
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
          building.x,
          currentHeight + block.height / 2,
          building.z
        );
        
        // Store function data in userData for click/hover
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

        // Add wireframe edges
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ 
          color: 0xffffff, 
          opacity: 0.3, 
          transparent: true 
        });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        mesh.add(wireframe);
        
        geometriesToDispose.push(edges);
        materialsToDispose.push(lineMaterial);
        
        currentHeight += block.height;
      });
    });

    // Raycaster for hover and click detection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onHoverMove = (event) => {
      if (!mountRef.current || isMouseDown) return; // Don't hover when dragging
      const rect = mountRef.current.getBoundingClientRect();

      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      setHoverInfoPosition({ x: event.clientX + 10, y: event.clientY + 10 });

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(blockMeshes);

      // Reset emissive for all blocks
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
    };

    const onMouseClick = (event) => {
      if (!mountRef.current || isMouseDown) return; // Don't click when dragging
      const rect = mountRef.current.getBoundingClientRect();

      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(blockMeshes);

      if (intersects.length > 0 && onFunctionClick) {
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
      }
    };

    mountRef.current.addEventListener('mousemove', onHoverMove);
    mountRef.current.addEventListener('click', onMouseClick);

    // WASD keyboard controls
    const handleKeyDown = (event) => {
      keysRef.current[event.key.toLowerCase()] = true;
    };

    const handleKeyUp = (event) => {
      keysRef.current[event.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Mouse look controls
    let isMouseDown = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    
    // Initialize yaw and pitch from camera's initial rotation
    const initialEuler = new THREE.Euler().setFromQuaternion(camera.quaternion);
    let yaw = initialEuler.y;
    let pitch = initialEuler.x;
    
    const onMouseDownDrag = (event) => {
      if (!mountRef.current) return;
      isMouseDown = true;
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      mountRef.current.style.cursor = 'grabbing';
    };
    
    const onMouseUpDrag = () => {
      isMouseDown = false;
      if (mountRef.current) {
        mountRef.current.style.cursor = 'grab';
      }
    };
    
    const onMouseDrag = (event) => {
      if (!isMouseDown || !mountRef.current) return;
      
      const deltaX = event.clientX - lastMouseX;
      const deltaY = event.clientY - lastMouseY;
      
      yaw -= deltaX * rotateSpeed;
      pitch -= deltaY * rotateSpeed;
      pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch)); // Limit pitch
      
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
    };
    
    mountRef.current.addEventListener('mousedown', onMouseDownDrag);
    window.addEventListener('mouseup', onMouseUpDrag);
    mountRef.current.addEventListener('mousemove', onMouseDrag);
    
    // Set initial cursor style
    if (mountRef.current) {
      mountRef.current.style.cursor = 'grab';
    }

    // Animation loop with WASD movement
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      
      // Apply mouse look rotation
      const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
      camera.quaternion.setFromEuler(euler);
      
      // WASD movement
      const keys = keysRef.current;
      const moveVector = new THREE.Vector3();
      
      if (keys['w']) {
        moveVector.z -= moveSpeed;
      }
      if (keys['s']) {
        moveVector.z += moveSpeed;
      }
      if (keys['a']) {
        moveVector.x -= moveSpeed;
      }
      if (keys['d']) {
        moveVector.x += moveSpeed;
      }
      if (keys['shift']) {
        moveVector.y += moveSpeed;
      }
      if (keys['control']) {
        moveVector.y -= moveSpeed;
      }
      
      // Apply movement relative to camera direction
      if (moveVector.length() > 0) {
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0; // Keep movement horizontal
        cameraDirection.normalize();
        
        const rightVector = new THREE.Vector3();
        rightVector.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));
        
        const forwardMovement = cameraDirection.multiplyScalar(-moveVector.z);
        const rightMovement = rightVector.multiplyScalar(moveVector.x);
        
        camera.position.add(forwardMovement);
        camera.position.add(rightMovement);
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
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

      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeEventListener('mousemove', onHoverMove);
        mountRef.current.removeEventListener('click', onMouseClick);
        mountRef.current.removeEventListener('mousedown', onMouseDownDrag);
        mountRef.current.removeEventListener('mousemove', onMouseDrag);
        window.removeEventListener('mouseup', onMouseUpDrag);
        if (mountRef.current.contains(renderer.domElement)) {
          mountRef.current.removeChild(renderer.domElement);
        }
      }

      if (controlsRef.current) {
        controlsRef.current.dispose();
      }

      geometriesToDispose.forEach(geom => geom.dispose());
      materialsToDispose.forEach(mat => mat.dispose());
      platformGeometry.dispose();
      platformMaterial.dispose();
      borderGeometry.dispose();
      borderMaterial.dispose();
      boundaryGeometry.dispose();
      boundaryMaterial.dispose();
      gridHelper.geometry.dispose();

      renderer.dispose();
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
    };
  }, [individualFiles, onFunctionClick, minComplexity, maxComplexity, maxNloc]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" style={{ minHeight: '55vh' }} />

      {/* Hover tooltip */}
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

      {/* Controls legend */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 z-10">
        <h4 className="font-bold text-sm mb-2 text-gray-900">Controls</h4>
        <div className="space-y-1 text-xs text-gray-700">
          <div>WASD - Move</div>
          <div>Shift/Ctrl - Up/Down</div>
          <div>Mouse Drag - Look around</div>
          <div>Click - View code</div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 z-10">
        <h4 className="font-bold text-sm mb-2 text-gray-900">Legend</h4>
        <div className="space-y-1 text-xs text-gray-700">
          <div>📏 Height = Lines of Code</div>
          <div>📦 Base Size = File Size</div>
          <div>🎨 Color = Complexity</div>
          <div className="mt-2 pt-2 border-t border-gray-200">
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

