import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

function CodeGalaxySolarSystem({ individualFiles, onFunctionClick }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const animationIdRef = useRef(null);
  const cameraRef = useRef(null);
  
  const [hoveredPlanet, setHoveredPlanet] = useState(null);
  const [hoverInfoPosition, setHoverInfoPosition] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState('galaxy'); // 'galaxy' or 'orbit'
  
  const keysRef = useRef({});
  const moveSpeed = 1.0;

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

    // Scene setup with space background
    const scene = new THREE.Scene();
    
    // Create starfield background
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(1024, 1024, 0, 1024, 1024, 1024);
    gradient.addColorStop(0, '#000033');
    gradient.addColorStop(0.5, '#000011');
    gradient.addColorStop(1, '#000000');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 2048, 2048);
    
    // Add stars to background
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * 2048;
      const y = Math.random() * 2048;
      const radius = Math.random() * 1.5;
      const brightness = Math.random();
      context.fillStyle = `rgba(255, 255, 255, ${brightness})`;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    scene.background = texture;
    scene.fog = new THREE.FogExp2(0x000000, 0.001);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      2000
    );
    camera.position.set(0, 100, 200);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x444444, 0.4);
    scene.add(ambientLight);

    const sunLight = new THREE.PointLight(0xffffff, 2, 500);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    const geometriesToDispose = [];
    const materialsToDispose = [];
    const planets = [];
    const moons = [];
    const orbitLines = [];

    // Create the Sun (central star)
    const sunGeometry = new THREE.SphereGeometry(8, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 1
    });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(0, 0, 0);
    scene.add(sun);
    geometriesToDispose.push(sunGeometry);
    materialsToDispose.push(sunMaterial);

    // Add sun glow
    const glowGeometry = new THREE.SphereGeometry(12, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.3
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    sun.add(glow);
    geometriesToDispose.push(glowGeometry);
    materialsToDispose.push(glowMaterial);

    // Add sun rays
    for (let i = 0; i < 8; i++) {
      const rayGeometry = new THREE.ConeGeometry(0.5, 20, 4);
      const rayMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.6
      });
      const ray = new THREE.Mesh(rayGeometry, rayMaterial);
      const angle = (i / 8) * Math.PI * 2;
      ray.position.set(Math.cos(angle) * 10, 0, Math.sin(angle) * 10);
      ray.lookAt(Math.cos(angle) * 30, 0, Math.sin(angle) * 30);
      sun.add(ray);
      geometriesToDispose.push(rayGeometry);
      materialsToDispose.push(rayMaterial);
    }

    // Create planets from files
    const planetColors = [
      0x4a90e2, 0xe94b3c, 0x50c878, 0x9b59b6, 
      0xf39c12, 0x1abc9c, 0xe74c3c, 0x3498db,
      0x2ecc71, 0xf1c40f, 0x9b59b6, 0x34495e
    ];

    individualFiles.forEach((file, fileIdx) => {
      const functions = file.functions || [];
      if (functions.length === 0) return;

      // Calculate planet properties
      const totalComplexity = functions.reduce((sum, fn) => 
        sum + (fn.cyclomatic_complexity || 1), 0
      );
      const avgComplexity = totalComplexity / functions.length;
      
      // Planet size based on total lines of code
      const totalLoc = functions.reduce((sum, fn) => sum + (fn.nloc || 0), 0);
      const planetSize = Math.max(2, Math.min(8, (totalLoc / maxNloc) * 8));
      
      // Orbit distance based on file index
      const orbitRadius = 30 + (fileIdx * 15);
      const orbitSpeed = 0.000005 + (fileIdx * 0.000002);
      const initialAngle = (fileIdx / individualFiles.length) * Math.PI * 2;

      // Create planet
      const planetGeometry = new THREE.SphereGeometry(planetSize, 32, 32);
      const planetColor = planetColors[fileIdx % planetColors.length];
      const planetMaterial = new THREE.MeshStandardMaterial({
        color: planetColor,
        roughness: 0.7,
        metalness: 0.3,
        emissive: planetColor,
        emissiveIntensity: 0.2
      });
      const planet = new THREE.Mesh(planetGeometry, planetMaterial);
      
      planet.position.set(
        Math.cos(initialAngle) * orbitRadius,
        (Math.random() - 0.5) * 10,
        Math.sin(initialAngle) * orbitRadius
      );
      
      planet.userData = {
        filename: file.filename,
        shortName: file.filename?.split('/').pop() || `File ${fileIdx + 1}`,
        functions: functions,
        totalComplexity: totalComplexity,
        avgComplexity: avgComplexity,
        totalLoc: totalLoc,
        orbitRadius: orbitRadius,
        orbitSpeed: orbitSpeed,
        angle: initialAngle,
        isPlanet: true,
        fileIndex: fileIdx
      };
      
      scene.add(planet);
      planets.push(planet);
      geometriesToDispose.push(planetGeometry);
      materialsToDispose.push(planetMaterial);

      // Create orbit line
      const orbitGeometry = new THREE.BufferGeometry();
      const orbitPoints = [];
      for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * Math.PI * 2;
        orbitPoints.push(
          Math.cos(angle) * orbitRadius,
          0,
          Math.sin(angle) * orbitRadius
        );
      }
      orbitGeometry.setAttribute('position', new THREE.Float32BufferAttribute(orbitPoints, 3));
      const orbitMaterial = new THREE.LineBasicMaterial({ 
        color: 0x444444,
        transparent: true,
        opacity: 0.3
      });
      const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
      scene.add(orbitLine);
      orbitLines.push(orbitLine);
      geometriesToDispose.push(orbitGeometry);
      materialsToDispose.push(orbitMaterial);

      // Create moons (functions) around planet
      functions.forEach((fn, fnIdx) => {
        const moonSize = Math.max(0.3, Math.min(1.5, (fn.nloc || 1) / maxNloc * 3));
        const moonOrbitRadius = planetSize + 2 + (fnIdx * 1.5);
        const moonSpeed = 0.0001 + (fnIdx * 0.00005);
        const moonAngle = (fnIdx / functions.length) * Math.PI * 2;

        const moonGeometry = new THREE.SphereGeometry(moonSize, 16, 16);
        const moonColor = getComplexityColor(fn.cyclomatic_complexity);
        const moonMaterial = new THREE.MeshStandardMaterial({
          color: moonColor,
          roughness: 0.8,
          metalness: 0.2,
          emissive: moonColor,
          emissiveIntensity: 0.3
        });
        const moon = new THREE.Mesh(moonGeometry, moonMaterial);
        
        moon.userData = {
          functionName: fn.name || 'Unknown',
          filename: file.filename,
          startLine: fn.start_line,
          nloc: fn.nloc,
          complexity: fn.cyclomatic_complexity,
          parentPlanet: planet,
          moonOrbitRadius: moonOrbitRadius,
          moonSpeed: moonSpeed,
          moonAngle: moonAngle,
          isMoon: true
        };
        
        scene.add(moon);
        moons.push(moon);
        geometriesToDispose.push(moonGeometry);
        materialsToDispose.push(moonMaterial);

        // Moon orbit line
        const moonOrbitGeometry = new THREE.BufferGeometry();
        const moonOrbitPoints = [];
        for (let i = 0; i <= 32; i++) {
          const angle = (i / 32) * Math.PI * 2;
          moonOrbitPoints.push(
            Math.cos(angle) * moonOrbitRadius,
            0,
            Math.sin(angle) * moonOrbitRadius
          );
        }
        moonOrbitGeometry.setAttribute('position', new THREE.Float32BufferAttribute(moonOrbitPoints, 3));
        const moonOrbitMaterial = new THREE.LineBasicMaterial({ 
          color: 0x666666,
          transparent: true,
          opacity: 0.2
        });
        const moonOrbitLine = new THREE.Line(moonOrbitGeometry, moonOrbitMaterial);
        moonOrbitLine.userData.parentPlanet = planet;
        scene.add(moonOrbitLine);
        orbitLines.push(moonOrbitLine);
        geometriesToDispose.push(moonOrbitGeometry);
        materialsToDispose.push(moonOrbitMaterial);
      });
    });

    // Add distant stars (particles)
    const starsGeometry = new THREE.BufferGeometry();
    const starVertices = [];
    for (let i = 0; i < 5000; i++) {
      const x = (Math.random() - 0.5) * 2000;
      const y = (Math.random() - 0.5) * 2000;
      const z = (Math.random() - 0.5) * 2000;
      starVertices.push(x, y, z);
    }
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starsMaterial = new THREE.PointsMaterial({ 
      color: 0xffffff, 
      size: 1,
      transparent: true,
      opacity: 0.8
    });
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starField);
    geometriesToDispose.push(starsGeometry);
    materialsToDispose.push(starsMaterial);

    // Raycaster for interactions
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
      
      const intersects = raycaster.intersectObjects([...planets, ...moons]);

      if (intersects.length > 0 && !isMouseLocked) {
        const clicked = intersects[0].object;
        
        if (clicked.userData.isMoon && onFunctionClick) {
          onFunctionClick({
            filename: clicked.userData.filename,
            functionName: clicked.userData.functionName,
            startLine: clicked.userData.startLine,
            nloc: clicked.userData.nloc,
            complexity: clicked.userData.complexity
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
        const intersects = raycaster.intersectObjects([...planets, ...moons]);

        planets.forEach(p => {
          if (p.material && p.material.emissiveIntensity !== undefined) {
            p.material.emissiveIntensity = 0.2;
          }
        });
        moons.forEach(m => {
          if (m.material && m.material.emissiveIntensity !== undefined) {
            m.material.emissiveIntensity = 0.3;
          }
        });

        if (intersects.length > 0) {
          const hovered = intersects[0].object;
          if (hovered.material && hovered.material.emissiveIntensity !== undefined) {
            hovered.material.emissiveIntensity = 0.8;
          }
          setHoveredPlanet(hovered.userData);
        } else {
          setHoveredPlanet(null);
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
      
      // Rotate sun
      sun.rotation.y += 0.001;
      
      // Update planets orbiting around sun
      planets.forEach(planet => {
        planet.userData.angle += planet.userData.orbitSpeed;
        planet.position.x = Math.cos(planet.userData.angle) * planet.userData.orbitRadius;
        planet.position.z = Math.sin(planet.userData.angle) * planet.userData.orbitRadius;
        planet.rotation.y += 0.005;
      });
      
      // Update moons orbiting around planets
      moons.forEach(moon => {
        const parent = moon.userData.parentPlanet;
        moon.userData.moonAngle += moon.userData.moonSpeed;
        
        const localX = Math.cos(moon.userData.moonAngle) * moon.userData.moonOrbitRadius;
        const localZ = Math.sin(moon.userData.moonAngle) * moon.userData.moonOrbitRadius;
        
        moon.position.x = parent.position.x + localX;
        moon.position.y = parent.position.y;
        moon.position.z = parent.position.z + localZ;
        moon.rotation.y += 0.01;
      });
      
      // Update moon orbit lines to follow planets
      orbitLines.forEach(line => {
        if (line.userData.parentPlanet) {
          line.position.copy(line.userData.parentPlanet.position);
        }
      });
      
      // Camera controls
      if (!isMouseLocked) {
        // Auto-rotate camera in galaxy view
        if (viewMode === 'galaxy') {
          const radius = Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2);
          const currentAngle = Math.atan2(camera.position.z, camera.position.x);
          const newAngle = currentAngle + 0.001;
          camera.position.x = Math.cos(newAngle) * radius;
          camera.position.z = Math.sin(newAngle) * radius;
          camera.lookAt(0, 0, 0);
        }
      } else {
        const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(euler);
      }
      
      // WASD movement
      const keys = keysRef.current;
      const moveVector = new THREE.Vector3();
      
      if (keys['w']) moveVector.z -= moveSpeed;
      if (keys['s']) moveVector.z += moveSpeed;
      if (keys['a']) moveVector.x -= moveSpeed;
      if (keys['d']) moveVector.x += moveSpeed;
      if (keys[' ']) moveVector.y += moveSpeed;
      if (keys['shift']) moveVector.y -= moveSpeed;
      
      if (moveVector.length() > 0 && isMouseLocked) {
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

      geometriesToDispose.forEach(geom => geom.dispose());
      materialsToDispose.forEach(mat => mat.dispose());

      renderer.dispose();
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
    };
  }, [individualFiles, onFunctionClick, minComplexity, maxComplexity, maxNloc, viewMode]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" style={{ minHeight: '55vh' }} />

      {hoveredPlanet && (
        <div
          className="fixed z-50 bg-gray-900/95 border border-purple-500 rounded-lg shadow-2xl p-3 pointer-events-none"
          style={{
            left: `${hoverInfoPosition.x + 10}px`,
            top: `${hoverInfoPosition.y - 10}px`,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="text-sm text-white">
            {hoveredPlanet.isPlanet ? (
              <>
                <div className="font-semibold text-purple-300 mb-1">
                  🪐 {hoveredPlanet.shortName}
                </div>
                <div className="text-gray-300 text-xs">
                  <div>Functions: <span className="font-medium text-blue-300">{hoveredPlanet.functions?.length || 0}</span></div>
                  <div>Total LOC: <span className="font-medium text-green-300">{hoveredPlanet.totalLoc}</span></div>
                  <div>Avg Complexity: <span className="font-medium text-yellow-300">{hoveredPlanet.avgComplexity?.toFixed(1)}</span></div>
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold text-blue-300 mb-1">
                  🌙 {hoveredPlanet.functionName}
                </div>
                <div className="text-gray-300 text-xs">
                  <div>CC: <span className="font-medium text-red-300">{hoveredPlanet.complexity !== undefined ? hoveredPlanet.complexity : 'N/A'}</span></div>
                  <div>nloc: <span className="font-medium text-green-300">{hoveredPlanet.nloc}</span></div>
                  <div>Line: <span className="font-medium text-yellow-300">{hoveredPlanet.startLine}</span></div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-10 border border-purple-500">
        <div className="flex gap-2 items-center">
          <span className="text-purple-300 text-sm font-semibold">View:</span>
          <button
            onClick={() => setViewMode('galaxy')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
              viewMode === 'galaxy'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🌌 Galaxy
          </button>
          <button
            onClick={() => setViewMode('orbit')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
              viewMode === 'orbit'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🛸 Free Fly
          </button>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-lg p-4 z-10 border border-purple-500">
        <h4 className="font-bold text-sm mb-2 text-purple-300">🎮 Controls</h4>
        <div className="space-y-1 text-xs text-gray-300">
          <div>Click anywhere - Lock cursor</div>
          <div>WASD - Move (when locked)</div>
          <div>Space/Shift - Up/Down</div>
          <div>Move mouse - Look around</div>
          <div>ESC - Unlock cursor</div>
          <div>Click moon - View function</div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-lg p-4 z-10 border border-purple-500">
        <h4 className="font-bold text-sm mb-2 text-purple-300">🌟 Code Galaxy</h4>
        <div className="space-y-1 text-xs text-gray-300">
          <div>☀️ Sun = Your Codebase</div>
          <div>🪐 Planets = Files</div>
          <div>🌙 Moons = Functions</div>
          <div>📏 Size = Lines of Code</div>
          <div>🎨 Color = Complexity</div>
          <div className="mt-2 pt-2 border-t border-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }}></div>
              <span>Low Complexity</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
              <span>High Complexity</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CodeGalaxySolarSystem;