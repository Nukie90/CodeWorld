import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

function CodeCity3D() {
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
        console.log("Found existing Three.js content. Clearing mountRef.");
        // ลบ Child Node ทั้งหมด (รวมถึง Canvas และองค์ประกอบอื่น ๆ ที่อาจถูกสร้างไว้ก่อนหน้า)
        while (mountRef.current.firstChild) {
            mountRef.current.removeChild(mountRef.current.firstChild);
        }
    }

    // Mock data - buildings representing code files (KEEPING ALL BUILDINGS FOR WIDER SPACE)
    const buildings = [
      { name: 'App.jsx', x: 0, z: 0, width: 8, depth: 8, height: 15, complexity: 8, color: 0x60a5fa },
      { name: 'HomePage.jsx', x: 12, z: 0, width: 6, depth: 6, height: 12, complexity: 6, color: 0x34d399 },
      { name: 'Router.jsx', x: -12, z: 0, width: 4, depth: 4, height: 6, complexity: 3, color: 0xa78bfa },
      { name: 'utils.js', x: 0, z: 12, width: 3, depth: 3, height: 4, complexity: 2, color: 0xfbbf24 },
      { name: 'api.js', x: 8, z: 8, width: 5, depth: 5, height: 10, complexity: 5, color: 0xf87171 },
      { name: 'components/', x: -8, z: -8, width: 7, depth: 7, height: 8, complexity: 4, color: 0xc084fc },
      { name: 'Results.jsx', x: 0, z: -12, width: 6, depth: 6, height: 14, complexity: 7, color: 0x2dd4bf },
      { name: 'Upload.jsx', x: -12, z: 12, width: 5, depth: 5, height: 9, complexity: 5, color: 0xfb923c },
      { name: 'index.css', x: 12, z: 12, width: 2, depth: 2, height: 2, complexity: 1, color: 0xec4899 },
      { name: 'main.jsx', x: 12, z: -12, width: 3, depth: 3, height: 5, complexity: 2, color: 0x14b8a6 },
      { name: 'config.js', x: -20, z: 20, width: 4, depth: 4, height: 7, complexity: 3, color: 0x81c784 },
      { name: 'services/auth.js', x: 25, z: -5, width: 6, depth: 6, height: 11, complexity: 6, color: 0xffa07a },
      { name: 'data/models.js', x: -15, z: -20, width: 5, depth: 5, height: 9, complexity: 4, color: 0x9370db },
      { name: 'assets/images/', x: 30, z: 20, width: 3, depth: 3, height: 2, complexity: 1, color: 0xadd8e6 },
    ];

    // --- Dynamic Bounding Box Calculation ---
    // Find the minimum and maximum X and Z coordinates of all buildings
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    buildings.forEach(b => {
      minX = Math.min(minX, b.x - b.width / 2);
      maxX = Math.max(maxX, b.x + b.width / 2);
      minZ = Math.min(minZ, b.z - b.depth / 2);
      maxZ = Math.max(maxZ, b.z + b.depth / 2);
    });

    // Calculate the platform size based on the building extent, plus a margin
    const margin = 10;
    const platformWidth = (maxX - minX) + margin * 2;
    const platformDepth = (maxZ - minZ) + margin * 2;
    const platformCenterX = (minX + maxX) / 2;
    const platformCenterZ = (minZ + maxZ) / 2;

    const platformSize = Math.max(platformWidth, platformDepth);
    // --- End Dynamic Bounding Box Calculation ---
    
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f4f8);
    scene.fog = new THREE.Fog(0xf0f4f8, 50, 200);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    // Position camera dynamically based on calculated size
    const cameraDistance = platformSize * 1.5;
    camera.position.set(cameraDistance, cameraDistance * 0.75, cameraDistance); 
    camera.lookAt(platformCenterX, 0, platformCenterZ);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // OrbitControls for user interaction
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;
    controls.target.set(platformCenterX, 0, platformCenterZ); // Set target to the center of the city
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);

    // Platform (using dynamic size and center)
    const platformGeometry = new THREE.BoxGeometry(platformWidth, 0.5, platformDepth);
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0xd0e0f0,
      roughness: 0.6,
      metalness: 0.1
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.set(platformCenterX, -0.25, platformCenterZ);
    scene.add(platform);

    // Platform border/edges
    const borderGeometry = new THREE.EdgesGeometry(platformGeometry);
    const borderMaterial = new THREE.LineBasicMaterial({ color: 0x88aacc, linewidth: 2 });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);
    platform.add(border);

    // Grid on platform
    const gridHelper = new THREE.GridHelper(platformSize * 2, platformSize, 0x99bbdd, 0xbbddee);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);
    
    // --- Green boundary that tightly fits the buildings (Dynamic) ---
    const greenBoundaryPadding = 1.0; // Margin around the building extent
    const boundaryBoxWidth = (maxX - minX) + greenBoundaryPadding * 2;
    const boundaryBoxDepth = (maxZ - minZ) + greenBoundaryPadding * 2;
    
    const boundaryGeometry = new THREE.BoxGeometry(boundaryBoxWidth, 0.1, boundaryBoxDepth); 
    const boundaryEdges = new THREE.EdgesGeometry(boundaryGeometry);
    const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0x228B22, linewidth: 4 });
    const greenBoundary = new THREE.LineSegments(boundaryEdges, boundaryMaterial);
    
    // Position boundary box at the calculated center of the buildings
    greenBoundary.position.set(platformCenterX, 0.05, platformCenterZ); 
    scene.add(greenBoundary);
    // -------------------------------------------------------------------

    const buildingMeshes = [];

    buildings.forEach((building) => {
      const geometry = new THREE.BoxGeometry(building.width, building.height, building.depth);
      const material = new THREE.MeshStandardMaterial({
        color: building.color,
        roughness: 0.4,
        metalness: 0.3
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(building.x, building.height / 2, building.z);
      mesh.userData = building;
      scene.add(mesh);
      buildingMeshes.push(mesh);

      const edges = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.3, transparent: true });
      const wireframe = new THREE.LineSegments(edges, lineMaterial);
      mesh.add(wireframe);
    });

    // Raycaster for hover detection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMove = (event) => {
      if (!mountRef.current) return;
      const rect = mountRef.current.getBoundingClientRect();

      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Update hover info position relative to the viewport
      setHoverInfoPosition({ x: event.clientX + 10, y: event.clientY + 10 });

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(buildingMeshes);

      // Reset emissive for all buildings (with safe check)
      buildingMeshes.forEach(mesh => {
        if (mesh.material && !Array.isArray(mesh.material) && mesh.material.emissive) {
          mesh.material.emissive.setHex(0x000000);
        }
      });

      if (intersects.length > 0) {
        const hoveredMesh = intersects[0].object;

        if (hoveredMesh.material && !Array.isArray(hoveredMesh.material) && hoveredMesh.material.emissive) {
          hoveredMesh.material.emissive.setHex(0x444444);
          setHoveredBuilding(hoveredMesh.userData);
        }
      } else {
        setHoveredBuilding(null);
      }
    };

    mountRef.current.addEventListener('mousemove', onMouseMove);

    // Animation loop (for OrbitControls updates and rendering)
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      controls.update();
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

      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeEventListener('mousemove', onMouseMove);
        if (mountRef.current.contains(renderer.domElement)) {
          mountRef.current.removeChild(renderer.domElement);
        }
      }

      if (controlsRef.current) {
        controlsRef.current.dispose();
      }

      // Dispose all geometries and materials
      buildingMeshes.forEach(mesh => {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => mat.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      });

      platformGeometry.dispose();
      platformMaterial.dispose();
      borderGeometry.dispose();
      borderMaterial.dispose();
      
      // Dispose new boundary elements
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
      {/* Increased minimum height for a larger view */}
      <div ref={mountRef} className="w-full h-full" style={{ minHeight: '600px' }} /> 

      {/* Info overlay (position is controlled by mouse event) */}
      {hoveredBuilding && (
        <div
          className="absolute bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-xs z-10"
          style={{ 
              top: hoverInfoPosition.y, 
              left: hoverInfoPosition.x,
              transform: 'translate(-100%, 0)' // Move the box to the left of the cursor
          }}
        >
          <h4 className="font-bold text-lg mb-2 text-gray-900">{hoveredBuilding.name}</h4>
          <div className="space-y-1 text-sm text-gray-700">
            <div className="flex justify-between">
              <span>Lines:</span>
              <span className="font-semibold">{hoveredBuilding.height * 40}</span>
            </div>
            <div className="flex justify-between">
              <span>Complexity:</span>
              <span className="font-semibold">{hoveredBuilding.complexity}</span>
            </div>
            <div className="flex justify-between">
              <span>Size:</span>
              <span className="font-semibold">{(hoveredBuilding.width * hoveredBuilding.depth).toFixed(0)} KB</span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 z-10">
        <h4 className="font-bold text-sm mb-2 text-gray-900">Legend</h4>
        <div className="space-y-1 text-xs text-gray-700">
          <div>📏 Height = Lines of Code</div>
          <div>📦 Base Size = File Size</div>
          <div>🎨 Color = Complexity</div>
        </div>
      </div>

      {/* Folder name label */}
      <div className="absolute top-4 right-4 bg-blue-500/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 z-10">
        <p className="text-white font-semibold">📁 src/</p>
      </div>
    </div>
  );
}

export default CodeCity3D;