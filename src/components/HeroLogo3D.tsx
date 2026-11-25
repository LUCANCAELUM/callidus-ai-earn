import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const _vec3 = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const HeroLogo3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSoftwareGl = detectSoftwareWebGL();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || 420, container.clientHeight || 420);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05070a, 0.045);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const width = container.clientWidth || 420;
    const height = container.clientHeight || 420;
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 7.6);

    // Three-point warm/cool studio lighting
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x05070a, 0.75);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.2);
    keyLight.position.set(4.5, 6, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x10b981, 2.6);
    rimLight.position.set(-5, -2, -4);
    scene.add(rimLight);

    const violetAccentLight = new THREE.PointLight(0x8b5cf6, 2.0, 14);
    violetAccentLight.position.set(2.8, -2.2, 2.5);
    scene.add(violetAccentLight);

    // Composite 3D CALLIDUS EARN AI Emblem Group (multi-part procedural geometry)
    const emblemGroup = new THREE.Group();
    scene.add(emblemGroup);

    // 1. Primary Silhouette: Beveled Obsidian Hexagonal Chassis
    const hexShape = new THREE.Shape();
    const outerR = 2.05;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * outerR;
      const y = Math.sin(a) * outerR;
      if (i === 0) hexShape.moveTo(x, y);
      else hexShape.lineTo(x, y);
    }
    hexShape.closePath();

    const holePath = new THREE.Path();
    const innerR = 1.56;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * innerR;
      const y = Math.sin(a) * innerR;
      if (i === 0) holePath.moveTo(x, y);
      else holePath.lineTo(x, y);
    }
    holePath.closePath();
    hexShape.holes.push(holePath);

    const hexGeo = new THREE.ExtrudeGeometry(hexShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 3,
    });
    hexGeo.center();

    const obsidianMetal = new THREE.MeshPhysicalMaterial({
      color: 0x111827,
      metalness: 0.92,
      roughness: 0.18,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    });
    const hexFrame = new THREE.Mesh(hexGeo, obsidianMetal);
    emblemGroup.add(hexFrame);

    // 2. Secondary Read: Emerald Precision Inner "C" Crest
    const arcGeo = new THREE.TorusGeometry(1.06, 0.14, 24, 64, Math.PI * 1.48);
    const emeraldMetal = new THREE.MeshPhysicalMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.35,
      metalness: 0.78,
      roughness: 0.22,
      clearcoat: 1.0,
    });
    const crestArc = new THREE.Mesh(arcGeo, emeraldMetal);
    crestArc.rotation.z = Math.PI * 0.26;
    emblemGroup.add(crestArc);

    // 3. Central Faceted Neural Core
    const coreGeo = new THREE.OctahedronGeometry(0.62, 1);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.45,
      metalness: 0.35,
      roughness: 0.12,
      clearcoat: 1.0,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    emblemGroup.add(coreMesh);

    // 4. Counter-Rotating Orbital Telemetry Rings
    const cyanRingGeo = new THREE.TorusGeometry(2.38, 0.032, 16, 96);
    const cyanRingMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.55,
      metalness: 0.65,
      roughness: 0.25,
    });
    const cyanRing = new THREE.Mesh(cyanRingGeo, cyanRingMat);
    cyanRing.rotation.x = Math.PI * 0.32;
    emblemGroup.add(cyanRing);

    const violetRingGeo = new THREE.TorusGeometry(2.65, 0.026, 16, 96);
    const violetRingMat = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      emissive: 0x7c3aed,
      emissiveIntensity: 0.5,
      metalness: 0.7,
      roughness: 0.3,
    });
    const violetRing = new THREE.Mesh(violetRingGeo, violetRingMat);
    violetRing.rotation.y = Math.PI * 0.28;
    violetRing.rotation.x = -Math.PI * 0.22;
    emblemGroup.add(violetRing);

    // 5. Violet Node Anchor inside the "C" opening
    const anchorGeo = new THREE.SphereGeometry(0.22, 24, 24);
    const anchorMat = new THREE.MeshPhysicalMaterial({
      color: 0x8b5cf6,
      emissive: 0x7c3aed,
      emissiveIntensity: 0.65,
      metalness: 0.4,
      roughness: 0.15,
    });
    const anchorNode = new THREE.Mesh(anchorGeo, anchorMat);
    anchorNode.position.set(1.06, 0, 0);
    emblemGroup.add(anchorNode);

    // 6. Instanced Orbiting Micro-Nodes
    const nodeCount = 24;
    const instancedGeo = new THREE.IcosahedronGeometry(0.055, 0);
    const instancedMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 0.6,
      metalness: 0.5,
      roughness: 0.2,
    });
    const instancedNodes = new THREE.InstancedMesh(instancedGeo, instancedMat, nodeCount);
    instancedNodes.frustumCulled = false;
    for (let i = 0; i < nodeCount; i++) {
      const theta = (i / nodeCount) * Math.PI * 2;
      const radius = 2.95 + (i % 3) * 0.22;
      _vec3.set(
        Math.cos(theta) * radius,
        Math.sin(theta * 2) * 0.55,
        Math.sin(theta) * radius * 0.42
      );
      _mat4.compose(_vec3, _quat, _scale);
      instancedNodes.setMatrixAt(i, _mat4);
    }
    instancedNodes.instanceMatrix.needsUpdate = true;
    instancedNodes.computeBoundingSphere();
    emblemGroup.add(instancedNodes);

    // 7. Ground Contact Shadow Halo
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(128, 128, 10, 128, 128, 124);
      grad.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
      grad.addColorStop(0.5, 'rgba(6, 182, 212, 0.08)');
      grad.addColorStop(1, 'rgba(5, 7, 10, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 256, 256);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    shadowTex.colorSpace = THREE.SRGBColorSpace;
    const contactPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 5.6),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    );
    contactPlane.rotation.x = -Math.PI / 2;
    contactPlane.position.y = -2.65;
    scene.add(contactPlane);

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerRef.current.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerRef.current.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    container.addEventListener('pointermove', handlePointerMove);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 420;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFailed(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      if (!prefersReducedMotion) {
        const targetY = pointerRef.current.x * 0.45 + Math.sin(elapsed * 0.45) * 0.18;
        const targetX = pointerRef.current.y * 0.25 + Math.cos(elapsed * 0.35) * 0.08;
        emblemGroup.rotation.y = THREE.MathUtils.damp(emblemGroup.rotation.y, targetY, 4.5, delta);
        emblemGroup.rotation.x = THREE.MathUtils.damp(emblemGroup.rotation.x, targetX, 4.5, delta);
        emblemGroup.position.y = Math.sin(elapsed * 1.1) * 0.09;

        coreMesh.rotation.y += delta * 0.55;
        coreMesh.rotation.x += delta * 0.35;
        cyanRing.rotation.z += delta * 0.38;
        violetRing.rotation.z -= delta * 0.28;
        instancedNodes.rotation.y -= delta * 0.16;
      }

      renderer.render(scene, camera);
      if (prefersReducedMotion) return;
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      hexGeo.dispose();
      arcGeo.dispose();
      coreGeo.dispose();
      cyanRingGeo.dispose();
      violetRingGeo.dispose();
      anchorGeo.dispose();
      instancedGeo.dispose();
      obsidianMetal.dispose();
      emeraldMetal.dispose();
      coreMat.dispose();
      cyanRingMat.dispose();
      violetRingMat.dispose();
      anchorMat.dispose();
      instancedMat.dispose();
      shadowTex.dispose();
      envTarget.dispose();
      renderer.dispose();
    };
  }, []);

  if (webglFailed) {
    return (
      <div className="flex h-full min-h-[320px] w-full items-center justify-center rounded-2xl border border-white/10 bg-[#0B1118] p-8">
        <img
          src="/icon.svg"
          alt="CALLIDUS EARN AI 3D Emblem"
          className="h-44 w-44 object-contain"
        />
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      aria-label="Interactive 3D Callidus Earn AI hexagonal intelligence core"
      className="h-[340px] w-full cursor-grab active:cursor-grabbing sm:h-[420px]"
    />
  );
};
