(() => {
  'use strict';

  const canvas = document.querySelector('#keychain3dCanvas');
  if (!canvas || !window.THREE || !window.MIZRACH_LOGO_DATA_URL) {
    window.MizrachKeychain3D = { ready: false, loaded: false, setRotation() {}, setOrientation() {}, render() {} };
    return;
  }

  try {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 50);
    scene.add(new THREE.HemisphereLight(0xf8fafc, 0x111317, 0.72));
    const key = new THREE.DirectionalLight(0xffffff, 1.75);
    key.position.set(4.5, 7, 8);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xb8c6dc, 0.5);
    fill.position.set(-4, 1.5, 6);
    scene.add(fill);
    const rimLight = new THREE.DirectionalLight(0xffe9c8, 0.62);
    rimLight.position.set(-5, 4, -4);
    scene.add(rimLight);
    const topLight = new THREE.DirectionalLight(0xffffff, 0.42);
    topLight.position.set(0, 9, 1);
    scene.add(topLight);

    const keychain = new THREE.Group();
    keychain.position.y = -0.15;
    scene.add(keychain);

    const metal = new THREE.MeshPhysicalMaterial({
      color: 0xb8b5ae,
      roughness: 0.24,
      metalness: 0.92,
      clearcoat: 0.42,
      clearcoatRoughness: 0.2,
      side: THREE.DoubleSide
    });
    const darkMetal = new THREE.MeshPhysicalMaterial({
      color: 0x2b2a28,
      roughness: 0.34,
      metalness: 0.8,
      clearcoat: 0.2,
      clearcoatRoughness: 0.3,
      side: THREE.DoubleSide
    });
    const blackFace = new THREE.MeshPhysicalMaterial({
      color: 0x050607,
      roughness: 0.5,
      metalness: 0.08,
      clearcoat: 0.28,
      clearcoatRoughness: 0.38,
      side: THREE.DoubleSide
    });

    const pendant = new THREE.Group();
    pendant.position.y = -0.55;
    keychain.add(pendant);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.13, 128), darkMetal);
    body.rotation.x = Math.PI / 2;
    pendant.add(body);

    const frontFace = new THREE.Mesh(new THREE.CircleGeometry(0.945, 128), blackFace);
    frontFace.position.z = 0.068;
    pendant.add(frontFace);
    const backFace = new THREE.Mesh(new THREE.CircleGeometry(0.945, 128), blackFace);
    backFace.rotation.y = Math.PI;
    backFace.position.z = -0.068;
    pendant.add(backFace);

    const frontRim = new THREE.Mesh(new THREE.TorusGeometry(0.975, 0.035, 16, 160), metal);
    frontRim.position.z = 0.074;
    pendant.add(frontRim);
    const backRim = frontRim.clone();
    backRim.position.z = -0.074;
    pendant.add(backRim);

    const logoTexture = new THREE.TextureLoader().load(window.MIZRACH_LOGO_DATA_URL, render);
    logoTexture.encoding = THREE.sRGBEncoding;
    logoTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const logoMaterial = new THREE.MeshStandardMaterial({
      map: logoTexture,
      transparent: true,
      alphaTest: 0.025,
      depthWrite: false,
      roughness: 0.55,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      side: THREE.FrontSide
    });
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.96), logoMaterial);
    logo.position.set(0, 0.02, 0.081);
    pendant.add(logo);

    const eyelet = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.035, 14, 72), metal);
    eyelet.position.set(0, 1.03, 0);
    pendant.add(eyelet);

    const chainRoot = new THREE.Group();
    chainRoot.position.y = 1.415;
    keychain.add(chainRoot);
    const chainLinks = [];
    const chainPivots = [];
    const jointStates = [];
    let chainParent = chainRoot;
    for (let index = 0; index < 4; index += 1) {
      const pivot = new THREE.Group();
      if (index > 0) pivot.position.y = -0.19;
      chainParent.add(pivot);
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.024, 12, 56), metal);
      link.scale.y = 1.16;
      link.position.set(0, -0.095, 0);
      link.rotation.y = index % 2 === 0 ? Math.PI / 3 : -Math.PI / 3;
      pivot.add(link);
      chainLinks.push(link);
      chainPivots.push(pivot);
      jointStates.push({ angleX: 0, angleZ: 0, velocityX: 0, velocityZ: 0 });
      chainParent = pivot;
    }
    const pendantAnchor = new THREE.Group();
    pendantAnchor.position.y = -0.19;
    chainParent.add(pendantAnchor);
    keychain.remove(pendant);
    pendant.position.y = -1.205;
    pendantAnchor.add(pendant);

    const splitRing = new THREE.Mesh(new THREE.TorusGeometry(0.59, 0.035, 16, 180), metal);
    splitRing.position.y = 2.02;
    keychain.add(splitRing);
    const handleHitArea = new THREE.Mesh(
      new THREE.CircleGeometry(0.54, 64),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    handleHitArea.position.y = 2.02;
    keychain.add(handleHitArea);
    const splitLayer = new THREE.Mesh(new THREE.TorusGeometry(0.555, 0.017, 10, 160), metal);
    splitLayer.position.set(0, 2.02, -0.026);
    keychain.add(splitLayer);
    const fitSize = new THREE.Vector3(2.2, 4.25, 0.5);
    const currentOrientation = new THREE.Quaternion();
    const handleRaycaster = new THREE.Raycaster();
    const handlePointer = new THREE.Vector2();
    const handleOffset = new THREE.Vector2();
    const handleVelocity = new THREE.Vector2();
    const handlePointerVelocity = new THREE.Vector2();
    const handleWorldCenter = new THREE.Vector3();
    const handleWorldEdge = new THREE.Vector3();
    const handleWorldTop = new THREE.Vector3();
    const pendantWorldCenter = new THREE.Vector3();
    const handleReturnStiffness = 26;
    const handleReturnDamping = 9;
    const chainSwingLimitBase = 0.18;
    const chainSwingLimitStep = 0.028;
    const handleChainImpulse = 0.024;
    const handleDisplacementResponse = 0.28;
    const chainSwingDamping = 4;
    let handleHeld = false;
    let handleLastX = 0;
    let handleLastY = 0;
    let handleLastTime = 0;
    let handleReleasedAt = 0;
    let secondaryFrame = 0;
    let secondaryLastTime = 0;

    function pointerToHandleRay(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      handlePointer.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      scene.updateMatrixWorld(true);
      handleRaycaster.setFromCamera(handlePointer, camera);
      return true;
    }

    function beginHandleDrag(clientX, clientY) {
      if (!pointerToHandleRay(clientX, clientY)) return false;
      const hits = handleRaycaster.intersectObjects([handleHitArea, splitRing], false);
      if (!hits.length) return false;
      handleHeld = true;
      handleReleasedAt = 0;
      handleLastX = clientX;
      handleLastY = clientY;
      handleLastTime = performance.now();
      handleVelocity.set(0, 0);
      if (!secondaryFrame) {
        secondaryLastTime = 0;
        secondaryFrame = requestAnimationFrame(stepSecondaryPhysics);
      }
      return true;
    }

    function applyHandleSwingImpulse(displacementX, displacementY, velocity) {
      jointStates.forEach((state, index) => {
        const weight = (index + 1) / jointStates.length;
        const limit = chainSwingLimitBase + index * chainSwingLimitStep;
        state.angleZ = THREE.MathUtils.clamp(
          state.angleZ - displacementX * (0.72 + weight * 0.68) * handleDisplacementResponse,
          -limit,
          limit
        );
        state.angleX = THREE.MathUtils.clamp(
          state.angleX + displacementY * (0.58 + weight * 0.54) * handleDisplacementResponse,
          -limit,
          limit
        );
        state.velocityZ = THREE.MathUtils.clamp(
          state.velocityZ - velocity.x * handleChainImpulse * weight,
          -4.8,
          4.8
        );
        state.velocityX = THREE.MathUtils.clamp(
          state.velocityX + velocity.y * handleChainImpulse * 0.82 * weight,
          -4.8,
          4.8
        );
      });
    }

    function moveHandle(clientX, clientY, now) {
      if (!handleHeld) return false;
      const rect = canvas.getBoundingClientRect();
      const dt = Math.max(1 / 240, Math.min(0.05, (now - handleLastTime) / 1000));
      const worldPerPixel = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * Math.abs(camera.position.z) / Math.max(1, rect.height);
      const previousX = handleOffset.x;
      const previousY = handleOffset.y;
      handlePointerVelocity.set(
        (clientX - handleLastX) * worldPerPixel / dt,
        -(clientY - handleLastY) * worldPerPixel / dt
      );
      handleOffset.x = THREE.MathUtils.clamp(handleOffset.x + (clientX - handleLastX) * worldPerPixel, -0.85, 0.85);
      handleOffset.y = THREE.MathUtils.clamp(handleOffset.y - (clientY - handleLastY) * worldPerPixel, -0.55, 0.55);
      keychain.position.set(handleOffset.x, handleOffset.y, 0);
      constrainHandleToCanvas(worldPerPixel);
      const displacementX = handleOffset.x - previousX;
      const displacementY = handleOffset.y - previousY;
      handleVelocity.lerp(handlePointerVelocity, 0.62);
      applyHandleSwingImpulse(displacementX, displacementY, handleVelocity);
      keychain.position.set(handleOffset.x, handleOffset.y, 0);
      applyPhysicsImpulse(new THREE.Vector3(-handleVelocity.y * 0.55, handleVelocity.x * 0.7, handleVelocity.x * 0.2));
      handleLastX = clientX;
      handleLastY = clientY;
      handleLastTime = now;
      render();
      return true;
    }

    function endHandleDrag(cancel = false) {
      if (!handleHeld && !cancel) return false;
      handleHeld = false;
      if (cancel) {
        resetPhysics();
        return true;
      }
      handleReleasedAt = performance.now();
      if (!secondaryFrame) {
        secondaryLastTime = 0;
        secondaryFrame = requestAnimationFrame(stepSecondaryPhysics);
      }
      return true;
    }

    function getHandleScreenPosition() {
      scene.updateMatrixWorld(true);
      splitRing.getWorldPosition(handleWorldCenter);
      handleWorldEdge.set(0.625, 2.02, 0);
      handleWorldTop.set(0, 2.645, 0);
      keychain.localToWorld(handleWorldEdge);
      keychain.localToWorld(handleWorldTop);
      handleWorldCenter.project(camera);
      handleWorldEdge.project(camera);
      handleWorldTop.project(camera);
      const rect = canvas.getBoundingClientRect();
      const x = rect.left + (handleWorldCenter.x + 1) * rect.width * 0.5;
      const y = rect.top + (1 - handleWorldCenter.y) * rect.height * 0.5;
      const edgeX = rect.left + (handleWorldEdge.x + 1) * rect.width * 0.5;
      const edgeY = rect.top + (1 - handleWorldEdge.y) * rect.height * 0.5;
      const topX = rect.left + (handleWorldTop.x + 1) * rect.width * 0.5;
      const topY = rect.top + (1 - handleWorldTop.y) * rect.height * 0.5;
      return {
        x,
        y,
        radius: Math.max(Math.hypot(edgeX - x, edgeY - y), Math.hypot(topX - x, topY - y)),
        held: handleHeld
      };
    }

    function constrainHandleToCanvas(worldPerPixel) {
      const rect = canvas.getBoundingClientRect();
      const projected = getHandleScreenPosition();
      const margin = 8;
      let correctionX = 0;
      let correctionY = 0;
      if (projected.x - projected.radius < rect.left + margin) correctionX = rect.left + margin - (projected.x - projected.radius);
      else if (projected.x + projected.radius > rect.right - margin) correctionX = rect.right - margin - (projected.x + projected.radius);
      if (projected.y - projected.radius < rect.top + margin) correctionY = rect.top + margin - (projected.y - projected.radius);
      else if (projected.y + projected.radius > rect.bottom - margin) correctionY = rect.bottom - margin - (projected.y + projected.radius);
      handleOffset.x += correctionX * worldPerPixel;
      handleOffset.y -= correctionY * worldPerPixel;
      keychain.position.set(handleOffset.x, handleOffset.y, 0);
    }

    function getPendantScreenPosition() {
      scene.updateMatrixWorld(true);
      pendant.getWorldPosition(pendantWorldCenter);
      pendantWorldCenter.project(camera);
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + (pendantWorldCenter.x + 1) * rect.width * 0.5,
        y: rect.top + (1 - pendantWorldCenter.y) * rect.height * 0.5
      };
    }

    function applyPhysicsImpulse(angularVelocity) {
      if (!angularVelocity || angularVelocity.length() < 0.12) return;
      jointStates.forEach((state, index) => {
        const weight = (index + 1) / jointStates.length;
        const impulseX = THREE.MathUtils.clamp(-(angularVelocity.x + angularVelocity.z * 0.45) * 0.0035 * weight, -0.025, 0.025);
        const impulseZ = THREE.MathUtils.clamp(angularVelocity.y * 0.0045 * weight, -0.03, 0.03);
        state.velocityX = THREE.MathUtils.clamp(state.velocityX + impulseX, -1.15, 1.15);
        state.velocityZ = THREE.MathUtils.clamp(state.velocityZ + impulseZ, -1.15, 1.15);
      });
      if (!secondaryFrame) {
        secondaryLastTime = 0;
        secondaryFrame = requestAnimationFrame(stepSecondaryPhysics);
      }
    }

    function stepSecondaryPhysics(now) {
      if (!handleHeld && handleReleasedAt && now - handleReleasedAt > 2200) {
        resetPhysics();
        return;
      }
      if (!secondaryLastTime) secondaryLastTime = now;
      const dt = Math.max(1 / 240, Math.min(0.033, (now - secondaryLastTime) / 1000));
      secondaryLastTime = now;
      let energy = 0;
      if (!handleHeld) {
        handleVelocity.x += (-handleReturnStiffness * handleOffset.x - handleReturnDamping * handleVelocity.x) * dt;
        handleVelocity.y += (-handleReturnStiffness * handleOffset.y - handleReturnDamping * handleVelocity.y) * dt;
        handleOffset.x += handleVelocity.x * dt;
        handleOffset.y += handleVelocity.y * dt;
        if (handleOffset.length() < 0.001 && handleVelocity.length() < 0.003) {
          handleOffset.set(0, 0);
          handleVelocity.set(0, 0);
        }
      }
      keychain.position.set(handleOffset.x, handleOffset.y, 0);
      energy += handleHeld ? 1 : handleOffset.length() + handleVelocity.length();
      jointStates.forEach((state, index) => {
        const stiffness = 8.4 + index * 0.9;
        const damping = chainSwingDamping;
        state.velocityX += (-stiffness * state.angleX - damping * state.velocityX) * dt;
        state.velocityZ += (-stiffness * state.angleZ - damping * state.velocityZ) * dt;
        state.angleX += state.velocityX * dt;
        state.angleZ += state.velocityZ * dt;
        const limit = chainSwingLimitBase + index * chainSwingLimitStep;
        const clampedX = THREE.MathUtils.clamp(state.angleX, -limit, limit);
        const clampedZ = THREE.MathUtils.clamp(state.angleZ, -limit, limit);
        if (clampedX !== state.angleX) state.velocityX *= -0.16;
        if (clampedZ !== state.angleZ) state.velocityZ *= -0.16;
        state.angleX = clampedX;
        state.angleZ = THREE.MathUtils.clamp(state.angleZ, -limit, limit);
        chainPivots[index].rotation.x = state.angleX;
        chainPivots[index].rotation.z = state.angleZ;
        energy += Math.abs(state.angleX) + Math.abs(state.angleZ) + Math.abs(state.velocityX) + Math.abs(state.velocityZ);
      });
      render();
      const sleepThreshold = handleReleasedAt ? 0.005 : 0.03;
      if (energy > sleepThreshold) secondaryFrame = requestAnimationFrame(stepSecondaryPhysics);
      else resetPhysics();
    }

    function resetPhysics() {
      if (secondaryFrame) cancelAnimationFrame(secondaryFrame);
      secondaryFrame = 0;
      secondaryLastTime = 0;
      handleHeld = false;
      handleReleasedAt = 0;
      handleOffset.set(0, 0);
      handleVelocity.set(0, 0);
      keychain.position.set(0, 0, 0);
      jointStates.forEach((state, index) => {
        state.angleX = 0;
        state.angleZ = 0;
        state.velocityX = 0;
        state.velocityZ = 0;
        chainPivots[index].rotation.x = 0;
        chainPivots[index].rotation.z = 0;
      });
      render();
    }

    function getPhysicsState() {
      return {
        active: Boolean(secondaryFrame),
        handleHeld,
        handleOffset: handleOffset.toArray(),
        handleVelocity: handleVelocity.toArray(),
        joints: jointStates.map(state => ({ ...state }))
      };
    }

    function fitCamera() {
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const distanceY = (fitSize.y * 1.08 * 0.5) / Math.tan(verticalFov / 2);
      const distanceX = (fitSize.x * 1.2 * 0.5) / Math.tan(horizontalFov / 2);
      const distance = Math.max(distanceY, distanceX) + fitSize.z * 0.6;
      camera.position.set(0, 0.3, distance);
      camera.lookAt(0, 0.3, 0);
      camera.near = Math.max(0.1, distance - 8);
      camera.far = distance + 14;
      camera.updateProjectionMatrix();
    }

    function resize() {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const ratio = renderer.getPixelRatio();
      if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        fitCamera();
      }
    }

    function render() { resize(); renderer.render(scene, camera); }
    function setRotation(degrees, pitch = 0) {
      currentOrientation.setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(pitch), THREE.MathUtils.degToRad(-degrees), 0, 'XYZ'));
      keychain.quaternion.copy(currentOrientation);
      render();
    }
    function setOrientation(quaternion) {
      currentOrientation.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w).normalize();
      keychain.quaternion.copy(currentOrientation);
      render();
    }

    if ('ResizeObserver' in window) new ResizeObserver(render).observe(canvas);
    else window.addEventListener('resize', render);

    window.MizrachKeychain3D = { ready: true, loaded: true, setRotation, setOrientation, getOrientation: () => currentOrientation.toArray(), beginHandleDrag, moveHandle, endHandleDrag, getHandleScreenPosition, getPendantScreenPosition, applyPhysicsImpulse, resetPhysics, getPhysicsState, render };
    setRotation(-8, 0);
    window.dispatchEvent(new CustomEvent('mizrach-keychain-3d-ready'));
  } catch (error) {
    console.error('Mizrach keychain failed to initialize:', error);
    window.MizrachKeychain3D = { ready: false, loaded: false, setRotation() {}, setOrientation() {}, render() {} };
  }
})();
