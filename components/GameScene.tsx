
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Point, Rope, LevelData } from '../types';

interface GameSceneProps {
  level: number;
  onComplete: () => void;
  onMove: () => void;
}

const COLORS = ['#FF3D71', '#3366FF', '#00D68F', '#FFAA00', '#D948FF', '#00E096', '#FF5722', '#00BCD4'];
const ROPE_RADIUS = 0.15;
const PIN_RADIUS = 0.52;

const GameScene: React.FC<GameSceneProps> = ({ level, onComplete, onMove }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const state = useRef({
    scene: null as THREE.Scene | null,
    camera: null as THREE.PerspectiveCamera | null,
    renderer: null as THREE.WebGLRenderer | null,
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    selectedPointId: null as string | null,
    dragPlane: new THREE.Plane(),
    dragIntersection: new THREE.Vector3(),
    dragOffset: new THREE.Vector3(),
    pins: new Map<string, THREE.Group>(),
    ropes: new Map<string, { mesh: THREE.Mesh; p1: string; p2: string; material: THREE.MeshStandardMaterial }>(),
    levelData: null as LevelData | null,
    isComplete: false,
    initialized: false
  });

  const triggerConfetti = () => {
    const duration = 2 * 1000;
    const animationEnd = Date.now() + duration;
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];

    const frame = () => {
      const confetti = document.createElement('div');
      confetti.style.position = 'fixed';
      confetti.style.zIndex = '999';
      confetti.style.width = '10px';
      confetti.style.height = '10px';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.left = Math.random() * 100 + 'vw';
      confetti.style.top = '-10px';
      confetti.style.borderRadius = '2px';
      confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(confetti);

      const animation = confetti.animate([
        { transform: `translate3d(0, 0, 0) rotate(0deg)`, opacity: 1 },
        { transform: `translate3d(${(Math.random() - 0.5) * 200}px, 100vh, 0) rotate(${Math.random() * 1000}deg)`, opacity: 0 }
      ], {
        duration: 1000 + Math.random() * 2000,
        easing: 'cubic-bezier(0, .9, .57, 1)'
      });

      animation.onfinish = () => confetti.remove();

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  /**
   * Procedural Solvable Level Generator
   * Starts with a solved state and scrambles it.
   */
  const generateLevel = (lvl: number): LevelData => {
    // Difficulty curve for 100 levels
    const pointCount = Math.min(5 + Math.floor(lvl / 10), 15);
    const connectionDensity = 1.2 + (lvl / 100) * 0.8; // How many ropes per pin
    const scrambleCount = 20 + lvl * 2;
    
    const points: Point[] = [];
    const ropes: Rope[] = [];

    // 1. Create pins in a "Solved" circle formation
    const radius = 4.5;
    for (let i = 0; i < pointCount; i++) {
      const angle = (i / pointCount) * Math.PI * 2;
      points.push({
        id: `p${i}`,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        z: 0,
        color: COLORS[i % COLORS.length]
      });
    }

    // 2. Create "Solved" ropes (Ring formation + some internal non-crossing struts)
    const connections = new Set<string>();
    const addRope = (i: number, j: number) => {
      const key = [i, j].sort((a, b) => a - b).join('-');
      if (i !== j && !connections.has(key)) {
        connections.add(key);
        ropes.push({ id: `r${ropes.length}`, p1: `p${i}`, p2: `p${j}`, color: '#ffffff' });
      }
    };

    // Mandatory ring (base solvability)
    for (let i = 0; i < pointCount; i++) {
      addRope(i, (i + 1) % pointCount);
    }

    // Add extra internal ropes that don't cross in the initial circular state
    // We only connect i to i+2, i+3 if it's safe in a convex polygon
    const extraRopes = Math.floor(pointCount * connectionDensity) - pointCount;
    for (let k = 0; k < extraRopes; k++) {
      const i = Math.floor(Math.random() * pointCount);
      const offset = 2 + Math.floor(Math.random() * (pointCount / 3));
      addRope(i, (i + offset) % pointCount);
    }

    // 3. SCRAMBLE: Swap pin positions randomly multiple times
    // This creates a mess that is guaranteed to be solvable by putting them back
    for (let s = 0; s < scrambleCount; s++) {
      const idxA = Math.floor(Math.random() * pointCount);
      const idxB = Math.floor(Math.random() * pointCount);
      const tempX = points[idxA].x;
      const tempY = points[idxA].y;
      points[idxA].x = points[idxB].x;
      points[idxA].y = points[idxB].y;
      points[idxB].x = tempX;
      points[idxB].y = tempY;
    }

    // 4. Add some noise so they aren't perfectly on the original grid
    points.forEach(p => {
      p.x += (Math.random() - 0.5) * 2;
      p.y += (Math.random() - 0.5) * 2;
    });

    return { points, ropes };
  };

  useEffect(() => {
    if (!containerRef.current) return;

    state.current.pins.clear();
    state.current.ropes.clear();
    state.current.initialized = false;
    state.current.isComplete = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    state.current.scene = scene;

    const aspect = window.innerWidth / window.innerHeight;
    const isPortrait = aspect < 1;
    const cameraZ = isPortrait ? 22 : 18;
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    camera.position.set(0, 0, cameraZ);
    state.current.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    state.current.renderer = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(5, 10, 15);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(1024, 1024);
    scene.add(mainLight);

    const levelData = generateLevel(level);
    state.current.levelData = levelData;

    levelData.points.forEach(p => {
      const group = new THREE.Group();
      const baseGeo = new THREE.CylinderGeometry(PIN_RADIUS, PIN_RADIUS, 0.4, 24);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.rotation.x = Math.PI / 2;
      group.add(base);

      const headGeo = new THREE.SphereGeometry(PIN_RADIUS * 0.9, 24, 24);
      const headMat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.1, metalness: 0.2 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.z = 0.4;
      head.castShadow = true;
      group.add(head);

      group.position.set(p.x, p.y, p.z);
      group.userData = { id: p.id };
      scene.add(group);
      state.current.pins.set(p.id, group);
    });

    const getRopeCurve = (p1: THREE.Vector3, p2: THREE.Vector3) => {
      const dist = p1.distanceTo(p2);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const sag = 0.2 + (dist * 0.04);
      mid.z += sag;
      return new THREE.CatmullRomCurve3([p1, mid, p2]);
    };

    const updateRopeMesh = (id: string, p1: THREE.Vector3, p2: THREE.Vector3, isTangled: boolean) => {
      const s = state.current;
      const ropeData = s.ropes.get(id);
      
      if (ropeData) {
        scene.remove(ropeData.mesh);
        ropeData.mesh.geometry.dispose();
      }

      const curve = getRopeCurve(p1, p2);
      const tubeGeo = new THREE.TubeGeometry(curve, 24, ROPE_RADIUS, 8, false);
      const material = ropeData?.material || new THREE.MeshStandardMaterial({ color: 0x2ECC71, roughness: 0.5 });
      material.color.set(isTangled ? 0xFF3D71 : 0x00FFBB);

      const mesh = new THREE.Mesh(tubeGeo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      
      const rData = state.current.levelData?.ropes.find(r => r.id === id);
      if (rData) {
        s.ropes.set(id, { mesh, p1: rData.p1, p2: rData.p2, material });
      }
    };

    const doIntersect = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
      const det = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
      if (Math.abs(det) < 0.001) return false;
      const lambda = ((d.y - c.y) * (d.x - a.x) + (c.x - d.x) * (d.y - a.y)) / det;
      const gamma = ((a.y - b.y) * (d.x - a.x) + (b.x - a.x) * (d.y - a.y)) / det;
      // Using a small epsilon to avoid overlapping point "false" intersections
      const eps = 0.05;
      return (eps < lambda && lambda < 1 - eps) && (eps < gamma && gamma < 1 - eps);
    };

    const checkIntersections = () => {
      const s = state.current;
      const tangledIds = new Set<string>();
      const ropeKeys = Array.from(s.ropes.keys());

      for (let i = 0; i < ropeKeys.length; i++) {
        for (let j = i + 1; j < ropeKeys.length; j++) {
          const r1 = s.ropes.get(ropeKeys[i]);
          const r2 = s.ropes.get(ropeKeys[j]);
          if (!r1 || !r2) continue;
          if (r1.p1 === r2.p1 || r1.p1 === r2.p2 || r1.p2 === r2.p1 || r1.p2 === r2.p2) continue;

          const pin1 = s.pins.get(r1.p1);
          const pin2 = s.pins.get(r1.p2);
          const pin3 = s.pins.get(r2.p1);
          const pin4 = s.pins.get(r2.p2);

          if (!pin1 || !pin2 || !pin3 || !pin4) continue;

          if (doIntersect(pin1.position, pin2.position, pin3.position, pin4.position)) {
            tangledIds.add(ropeKeys[i]);
            tangledIds.add(ropeKeys[j]);
          }
        }
      }

      ropeKeys.forEach(id => {
        const r = s.ropes.get(id);
        if (!r) return;
        const pinA = s.pins.get(r.p1);
        const pinB = s.pins.get(r.p2);
        if (pinA && pinB) {
          updateRopeMesh(id, pinA.position, pinB.position, tangledIds.has(id));
        }
      });

      return tangledIds.size === 0;
    };

    const checkWinCondition = () => {
      const s = state.current;
      if (!s.initialized || s.isComplete) return;

      const isSolved = checkIntersections();
      if (s.ropes.size > 0 && isSolved) {
        s.isComplete = true;
        triggerConfetti();
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    };

    levelData.ropes.forEach(r => {
      const p1 = state.current.pins.get(r.p1);
      const p2 = state.current.pins.get(r.p2);
      if (p1 && p2) {
        const curve = getRopeCurve(p1.position, p2.position);
        const tubeGeo = new THREE.TubeGeometry(curve, 24, ROPE_RADIUS, 8, false);
        const material = new THREE.MeshStandardMaterial({ color: 0xFF3D71, roughness: 0.5 });
        const mesh = new THREE.Mesh(tubeGeo, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        state.current.ropes.set(r.id, { mesh, p1: r.p1, p2: r.p2, material });
      }
    });
    
    state.current.initialized = true;
    checkIntersections();

    const onPointerDown = (e: PointerEvent) => {
      const s = state.current;
      if (s.isComplete) return;
      s.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      s.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      s.raycaster.setFromCamera(s.mouse, s.camera!);

      const intersects = s.raycaster.intersectObjects(Array.from(s.pins.values()), true);
      if (intersects.length > 0) {
        let target = intersects[0].object;
        while (target.parent && !target.userData.id) target = target.parent;
        s.selectedPointId = target.userData.id;
        s.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), target.position);
        if (s.raycaster.ray.intersectPlane(s.dragPlane, s.dragIntersection)) {
          s.dragOffset.copy(s.dragIntersection).sub(target.position);
        }
        target.scale.set(1.4, 1.4, 1.4);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const s = state.current;
      if (!s.selectedPointId || s.isComplete) return;

      s.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      s.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      s.raycaster.setFromCamera(s.mouse, s.camera!);

      if (s.raycaster.ray.intersectPlane(s.dragPlane, s.dragIntersection)) {
        const pin = s.pins.get(s.selectedPointId);
        if (pin) {
          const nextPos = s.dragIntersection.clone().sub(s.dragOffset);
          nextPos.x = THREE.MathUtils.clamp(nextPos.x, -9, 9);
          nextPos.y = THREE.MathUtils.clamp(nextPos.y, -14, 14);
          pin.position.copy(nextPos);
          checkIntersections();
        }
      }
    };

    const onPointerUp = () => {
      const s = state.current;
      if (s.selectedPointId) {
        const pin = s.pins.get(s.selectedPointId);
        if (pin) pin.scale.set(1, 1, 1);
        onMove();
        s.selectedPointId = null;
        checkWinCondition();
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const animate = () => {
      requestAnimationFrame(animate);
      if (state.current.renderer && state.current.scene && state.current.camera) {
        state.current.renderer.render(state.current.scene, state.current.camera);
      }
    };
    const animId = requestAnimationFrame(animate);

    const onResize = () => {
      if (!camera || !renderer) return;
      const newAspect = window.innerWidth / window.innerHeight;
      camera.aspect = newAspect;
      camera.position.z = newAspect < 1 ? 22 : 18;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [level]);

  return <div ref={containerRef} className="w-full h-full touch-none" />;
};

export default GameScene;
