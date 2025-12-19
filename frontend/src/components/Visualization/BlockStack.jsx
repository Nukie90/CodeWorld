import { useEffect, useRef, useState } from 'react'; // <-- FIXED THE IMPORT
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

function BlockStack() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const animationIdRef = useRef(null);
  const controlsRef = useRef(null);

  const [hoveredBuilding, setHoveredBuilding] = useState(null);
  const [hoverInfoPosition, setHoverInfoPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!mountRef.current) return;

    // Prevent duplicate scenes
    if (mountRef.current.hasChildNodes()) {
      while (mountRef.current.firstChild) {
        mountRef.current.removeChild(mountRef.current.firstChild);
      }
    }

    // --- MOCK DATA: Buildings arranged in a SQUARE GRID (3x3 with one spot empty) ---
    // Total building count: 7
    const buildings = [
      // Row 1
      { 
        name: 'mock.js A', 
        x: -18, z: 18, // Top-Left
        blocks: [
          { color: 0x86efac, height: 3 },  
          { color: 0x60a5fa, height: 2 },  
          { color: 0xfda4af, height: 2 },  
          { color: 0xfde047, height: 1 }  
        ],
        baseSize: 8 
      },
      { 
        name: 'mock.js B', 
        x: 0, z: 18, // Top-Center
        blocks: [
          { color: 0x86efac, height: 2 },
          { color: 0xfda4af, height: 4 },
          { color: 0x60a5fa, height: 2 },
          { color: 0xfde047, height: 3 } // TALLER roof
        ],
        baseSize: 10
      },
      { 
        name: 'mock.js C', 
        x: 18, z: 18, // Top-Right
        blocks: [
          { color: 0x86efac, height: 1 },
          { color: 0x60a5fa, height: 1 },
          { color: 0xfda4af, height: 1 },
          { color: 0xfde047, height: 1.5 } 
        ],
        baseSize: 6
      },
      // Row 2
      { 
        name: 'mock.js D', 
        x: -18, z: 0, // Middle-Left
        blocks: [
          { color: 0x86efac, height: 3 },
          { color: 0x60a5fa, height: 3 },
          { color: 0xfda4af, height: 2 },
          { color: 0xfde047, height: 1.2 } 
        ],
        baseSize: 8
      },
      // Middle-Center is EMPTY (for visual center)
      { 
        name: 'mock.js E', 
        x: 18, z: 0, // Middle-Right
        blocks: [
          { color: 0x86efac, height: 2 },
          { color: 0x60a5fa, height: 4 },
          { color: 0xfda4af, height: 1 },
          { color: 0xfde047, height: 4 } // VERY TALL roof
        ],
        baseSize: 7
      },
      // Row 3
      { 
        name: 'mock.js F', 
        x: -18, z: -18, // Bottom-Left
        blocks: [
          { color: 0x86efac, height: 3 },
          { color: 0xfda4af, height: 2 },
          { color: 0xfde047, height: 1 }
        ],
        baseSize: 8
      },
      { 
        name: 'mock.js G', 
        x: 0, z: -18, // Bottom-Center
        blocks: [
          { color: 0x86efac, height: 2 },
          { color: 0x60a5fa, height: 1 },
          { color: 0xfde047, height: 2 }
        ],
        baseSize: 7
      }
      // Bottom-Right is EMPTY
    ];
    // ---------------------------------------------------------------------------------

    // Dynamic bounding box calculation (modified to handle new layout)
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    buildings.forEach(b => {
      // Use the actual x/z coordinates for bounding box calculation
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
    scene.fog = new THREE.Fog(0xf0f4f8, 100, 300);
    sceneRef.current = scene;

    // Camera (lookAt target is now the center of the grid)
    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    const cameraDistance = platformSize * 1.2;
    camera.position.set(cameraDistance * 0.6, cameraDistance * 0.5, cameraDistance * 0.8); 
    camera.lookAt(platformCenterX, 0, platformCenterZ); // Look at the new center (0, 0)
    

    // Renderer (remains the same)
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // OrbitControls (target updated to the center of the grid)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;
    controls.target.set(platformCenterX, 0, platformCenterZ);
    controlsRef.current = controls;

    // Lights, Platform, Grid, Green Boundary (remain largely the same, but centered)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
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
    const greenBoundaryPadding = 2.0;
    const boundaryBoxWidth = (maxX - minX) + greenBoundaryPadding * 2;
    const boundaryBoxDepth = (maxZ - minZ) + greenBoundaryPadding * 2;
    
    const boundaryGeometry = new THREE.BoxGeometry(boundaryBoxWidth, 0.1, boundaryBoxDepth); 
    const boundaryEdges = new THREE.EdgesGeometry(boundaryGeometry);
    const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0x228B22, linewidth: 4 });
    const greenBoundary = new THREE.LineSegments(boundaryEdges, boundaryMaterial);
    greenBoundary.position.set(platformCenterX, 0.05, platformCenterZ); 
    scene.add(greenBoundary);

    const buildingMeshes = [];
    const geometriesToDispose = [];
    const materialsToDispose = [];

    // --- Block/Tapering Logic (remains the same) ---
    buildings.forEach((building) => {
      let currentHeight = 0;
      const numBlocks = building.blocks.length;
      
      const sizeReductionPerStep = (building.baseSize * 0.5) / (numBlocks); 
      let currentBaseSize = building.baseSize;
      const minBlockSize = building.baseSize * 0.3;

      building.blocks.forEach((block, blockIndex) => {
        const isRoof = blockIndex === building.blocks.length - 1;
        
        let blockWidth;
        let blockDepth;

        if (blockIndex === 0) {
            blockWidth = building.baseSize;
            blockDepth = building.baseSize;
        } else {
            blockWidth = building.baseSize - (blockIndex) * sizeReductionPerStep;
            blockDepth = building.baseSize - (blockIndex) * sizeReductionPerStep;
        }

        blockWidth = Math.max(blockWidth, minBlockSize);
        blockDepth = Math.max(blockDepth, minBlockSize);

        currentBaseSize = blockWidth - sizeReductionPerStep; 
        currentBaseSize = Math.max(currentBaseSize, minBlockSize);

        if (isRoof) {
          // *** Roof (Pyramid/Cone) ***
          const roofBaseRadius = blockWidth * 0.6; 
          const pyramidGeometry = new THREE.ConeGeometry(roofBaseRadius, block.height, 4); 
          const pyramidMaterial = new THREE.MeshStandardMaterial({
            color: block.color,
            roughness: 0.4,
            metalness: 0.3
          });
          
          const pyramid = new THREE.Mesh(pyramidGeometry, pyramidMaterial);
          pyramid.position.set(
            building.x, 
            currentHeight + block.height / 2, 
            building.z
          );
          pyramid.rotation.y = Math.PI / 4; 
          pyramid.userData = { 
            ...building, 
            blockIndex, 
            isRoof: true, 
            width: roofBaseRadius * 2, 
            depth: roofBaseRadius * 2, 
            height: block.height 
          };
          scene.add(pyramid);
          buildingMeshes.push(pyramid);
          
          geometriesToDispose.push(pyramidGeometry);
          materialsToDispose.push(pyramidMaterial);
          
          // Add edges to roof
          const roofEdges = new THREE.EdgesGeometry(pyramidGeometry);
          const roofLineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.4, transparent: true });
          const roofWireframe = new THREE.LineSegments(roofEdges, roofLineMaterial);
          pyramid.add(roofWireframe);
          
          geometriesToDispose.push(roofEdges);
          materialsToDispose.push(roofLineMaterial);
        } else {
          // *** Regular Block ***
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
          mesh.userData = { 
            ...building, 
            blockIndex, 
            isRoof: false, 
            width: blockWidth, 
            depth: blockDepth, 
            height: block.height 
          };
          scene.add(mesh);
          buildingMeshes.push(mesh);
          
          geometriesToDispose.push(geometry);
          materialsToDispose.push(material);

          // Add wireframe edges
          const edges = new THREE.EdgesGeometry(geometry);
          const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.3, transparent: true });
          const wireframe = new THREE.LineSegments(edges, lineMaterial);
          mesh.add(wireframe);
          
          geometriesToDispose.push(edges);
          materialsToDispose.push(lineMaterial);
        }
        
        currentHeight += block.height;
      });
    });
    // -----------------------------------------------------------------

    // Raycaster for hover (remains the same)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMove = (event) => {
      if (!mountRef.current) return;
      const rect = mountRef.current.getBoundingClientRect();

      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      setHoverInfoPosition({ x: event.clientX + 10, y: event.clientY + 10 });

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(buildingMeshes);

      buildingMeshes.forEach(mesh => {
        if (mesh.material && !Array.isArray(mesh.material) && mesh.material.emissive) {
          mesh.material.emissive.setHex(0x000000);
        }
      });

      if (intersects.length > 0) {
        const hoveredMesh = intersects[0].object;
        if (hoveredMesh.material && !Array.isArray(hoveredMesh.material) && hoveredMesh.material.emissive) {
          hoveredMesh.material.emissive.setHex(0x333333);
          setHoveredBuilding(hoveredMesh.userData);
        }
      } else {
        setHoveredBuilding(null);
      }
    };

    mountRef.current.addEventListener('mousemove', onMouseMove);

    // Animation, Resize, and Cleanup (remain the same)
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      controls.update();
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

      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeEventListener('mousemove', onMouseMove);
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
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" style={{ minHeight: '600px' }} /> 

      {hoveredBuilding && (
        <div
          className="absolute bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-xs z-10"
          style={{ 
            top: hoverInfoPosition.y, 
            left: hoverInfoPosition.x,
            transform: 'translate(-100%, 0)'
          }}
        >
          <h4 className="font-bold text-lg mb-2 text-gray-900">{hoveredBuilding.name}</h4>
          <div className="space-y-1 text-sm text-gray-700">
            <div className="flex justify-between">
              <span>Block:</span>
              <span className="font-semibold">{hoveredBuilding.blockIndex + 1}</span>
            </div>
            <div className="flex justify-between">
              <span>Type:</span>
              <span className="font-semibold">{hoveredBuilding.isRoof ? 'Roof (Cone)' : 'Block (Box)'}</span>
            </div>
            <div className="flex justify-between">
              <span>Size (W x D):</span>
              <span className="font-semibold">
                {hoveredBuilding.width.toFixed(1)} x {hoveredBuilding.depth.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Height:</span>
              <span className="font-semibold">
                {hoveredBuilding.height.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 z-10">
        <h4 className="font-bold text-sm mb-2 text-gray-900">Legend</h4>
        <div className="space-y-1 text-xs text-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-300 rounded"></div>
            <span>Green Block</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-400 rounded"></div>
            <span>Blue Block</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-pink-300 rounded"></div>
            <span>Pink Block</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-300 rounded"></div>
            <span>Yellow Roof (Cone)</span>
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 bg-blue-500/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 z-10">
        <p className="text-white font-semibold">📁 src/ - Stacked Pyramid View</p>
      </div>
    </div>
  );
}

export default BlockStack;