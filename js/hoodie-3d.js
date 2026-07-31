(() => {
  'use strict';

  const canvas = document.querySelector('#hoodie3dCanvas');
  if (!canvas || !window.THREE || !THREE.GLTFLoader || !THREE.DecalGeometry ||
      !window.MIZRACH_LOGO_DATA_URL || !window.MIZRACH_HOODIE_MODEL_DATA) {
    window.MizrachHoodie3D = { ready: false, loaded: false, setRotation() {}, setOrientation() {}, render() {} };
    return;
  }

  try {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.76;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
    scene.add(new THREE.HemisphereLight(0xf1f4f7, 0x040506, 0.48));

    const key = new THREE.DirectionalLight(0xfffbf5, 1.28);
    key.position.set(4.8, 6.5, 7.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fb1ce, 0.34);
    fill.position.set(-4.2, 1.6, 5.4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xd7ff45, 0.1);
    rim.position.set(-4.8, 4.2, -5.2);
    scene.add(rim);
    const top = new THREE.DirectionalLight(0xffecdc, 0.24);
    top.position.set(0, 8, 1.5);
    scene.add(top);

    const garment = new THREE.Group();
    scene.add(garment);
    const currentOrientation = new THREE.Quaternion();
    let currentDegrees = -8;
    let currentPitch = 0;
    let loaded = false;
    let modelFitSize = null;
    let modelRoot = null;
    let clothMaterial = null;
    let meshCount = 0;
    let vertexCount = 0;
    let decalVertexCount = 0;
    let rawModelSize = null;
    const drawstringPivots = [];
    const drawstringStates = [];
    const drawstringSwingLimit = 0.2;
    const drawstringImpulse = 0.026;
    const drawstringStiffness = 11.5;
    const drawstringDamping = 4.6;
    let drawstringFrame = 0;
    let drawstringLastTime = 0;

    function createFabricMaps() {
      const size = 128;
      const color = new Uint8Array(size * size * 3);
      const roughness = new Uint8Array(size * size * 3);
      let seed = 0x5f3759df;
      const random = () => {
        seed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed);
        return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
      };
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const offset = (y * size + x) * 3;
          const knit = Math.sin(x * Math.PI * 0.75) * 2.8 + Math.sin(y * Math.PI * 0.58) * 2.1;
          const fiber = (random() - 0.5) * 7;
          const shade = THREE.MathUtils.clamp(232 + knit + fiber, 212, 248);
          const rough = THREE.MathUtils.clamp(244 - knit * 0.45 + fiber * 0.3, 224, 255);
          color[offset] = color[offset + 1] = color[offset + 2] = shade;
          roughness[offset] = roughness[offset + 1] = roughness[offset + 2] = rough;
        }
      }
      const colorMap = new THREE.DataTexture(color, size, size, THREE.RGBFormat);
      colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
      colorMap.repeat.set(8, 10);
      colorMap.encoding = THREE.sRGBEncoding;
      colorMap.needsUpdate = true;
      const roughnessMap = new THREE.DataTexture(roughness, size, size, THREE.RGBFormat);
      roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
      roughnessMap.repeat.set(8, 10);
      roughnessMap.needsUpdate = true;
      return { colorMap, roughnessMap };
    }

    function fitCamera() {
      if (!modelFitSize) return;
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const distanceY = (modelFitSize.y * 1.16 * 0.5) / Math.tan(verticalFov / 2);
      const distanceX = (modelFitSize.x * 1.16 * 0.5) / Math.tan(horizontalFov / 2);
      const distance = Math.max(distanceY, distanceX) + modelFitSize.z * 0.58;
      camera.position.set(0, modelFitSize.y * 0.035, distance);
      camera.lookAt(0, modelFitSize.y * 0.015, 0);
      camera.near = Math.max(0.1, distance - modelFitSize.z * 3);
      camera.far = distance + modelFitSize.z * 7 + 10;
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

    function render() {
      resize();
      renderer.render(scene, camera);
    }

    function setRotation(degrees, pitch = 0) {
      currentDegrees = degrees;
      currentPitch = pitch;
      currentOrientation.setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(pitch),
        THREE.MathUtils.degToRad(-degrees),
        0,
        'XYZ'
      ));
      garment.quaternion.copy(currentOrientation);
      render();
    }

    function setOrientation(quaternion) {
      currentOrientation.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w).normalize();
      garment.quaternion.copy(currentOrientation);
      render();
    }

    function splitDrawstringMesh(sourceMesh) {
      const sourceGeometry = sourceMesh.geometry.index ? sourceMesh.geometry.toNonIndexed() : sourceMesh.geometry.clone();
      sourceGeometry.computeBoundingBox();
      const splitX = sourceGeometry.boundingBox.getCenter(new THREE.Vector3()).x;
      const sideAttributes = [{}, {}];
      Object.entries(sourceGeometry.attributes).forEach(([name]) => {
        sideAttributes[0][name] = [];
        sideAttributes[1][name] = [];
      });
      const position = sourceGeometry.attributes.position;
      for (let index = 0; index < position.count; index += 3) {
        const centroidX = (position.getX(index) + position.getX(index + 1) + position.getX(index + 2)) / 3;
        const side = centroidX < splitX ? 0 : 1;
        Object.entries(sourceGeometry.attributes).forEach(([name, attribute]) => {
          const values = sideAttributes[side][name];
          for (let vertex = index; vertex < index + 3; vertex += 1) {
            for (let component = 0; component < attribute.itemSize; component += 1) {
              values.push(attribute.array[vertex * attribute.itemSize + component]);
            }
          }
        });
      }

      const container = new THREE.Group();
      container.name = 'drawstringPhysicsRoot';
      container.position.copy(sourceMesh.position);
      container.quaternion.copy(sourceMesh.quaternion);
      container.scale.copy(sourceMesh.scale);
      sourceMesh.parent.add(container);

      sideAttributes.forEach((attributes, side) => {
        if (!attributes.position.length) return;
        const geometry = new THREE.BufferGeometry();
        Object.entries(sourceGeometry.attributes).forEach(([name, sourceAttribute]) => {
          const values = attributes[name];
          geometry.setAttribute(name, new THREE.BufferAttribute(
            new sourceAttribute.array.constructor(values),
            sourceAttribute.itemSize,
            sourceAttribute.normalized
          ));
        });
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        const anchor = new THREE.Vector3(
          (box.min.x + box.max.x) * 0.5,
          (box.min.y + box.max.y) * 0.5,
          box.max.z
        );
        geometry.translate(-anchor.x, -anchor.y, -anchor.z);
        const pivot = new THREE.Group();
        pivot.name = side === 0 ? 'leftDrawstringPivot' : 'rightDrawstringPivot';
        pivot.position.copy(anchor);
        const cord = new THREE.Mesh(geometry, cordMaterial);
        cord.name = side === 0 ? 'leftDrawstring' : 'rightDrawstring';
        pivot.add(cord);
        container.add(pivot);
        drawstringPivots.push(pivot);
        drawstringStates.push({ angleX: 0, angleY: 0, velocityX: 0, velocityY: 0 });
      });
      sourceMesh.visible = false;
      sourceGeometry.dispose();
    }

    function applyPhysicsImpulse(angularVelocity) {
      if (!angularVelocity || !drawstringStates.length || angularVelocity.length() < 0.04) return;
      drawstringStates.forEach((state, index) => {
        const variation = index === 0 ? 0.92 : 1.08;
        const separation = index === 0 ? -1 : 1;
        state.velocityX = THREE.MathUtils.clamp(
          state.velocityX + (angularVelocity.x + angularVelocity.z * 0.35) * drawstringImpulse * variation,
          -1.35,
          1.35
        );
        state.velocityY = THREE.MathUtils.clamp(
          state.velocityY - angularVelocity.y * drawstringImpulse * variation + angularVelocity.z * 0.004 * separation,
          -1.35,
          1.35
        );
      });
      if (!drawstringFrame) {
        drawstringLastTime = 0;
        drawstringFrame = requestAnimationFrame(stepDrawstringPhysics);
      }
    }

    function stepDrawstringPhysics(now) {
      if (!drawstringLastTime) drawstringLastTime = now;
      const dt = Math.max(1 / 240, Math.min(0.033, (now - drawstringLastTime) / 1000));
      drawstringLastTime = now;
      let energy = 0;
      drawstringStates.forEach((state, index) => {
        state.velocityX += (-drawstringStiffness * state.angleX - drawstringDamping * state.velocityX) * dt;
        state.velocityY += (-drawstringStiffness * state.angleY - drawstringDamping * state.velocityY) * dt;
        state.angleX += state.velocityX * dt;
        state.angleY += state.velocityY * dt;
        const clampedX = THREE.MathUtils.clamp(state.angleX, -drawstringSwingLimit, drawstringSwingLimit);
        const clampedY = THREE.MathUtils.clamp(state.angleY, -drawstringSwingLimit, drawstringSwingLimit);
        if (clampedX !== state.angleX) state.velocityX *= -0.12;
        if (clampedY !== state.angleY) state.velocityY *= -0.12;
        state.angleX = clampedX;
        state.angleY = clampedY;
        drawstringPivots[index].rotation.x = state.angleX;
        drawstringPivots[index].rotation.y = state.angleY;
        energy += Math.abs(state.angleX) + Math.abs(state.angleY) + Math.abs(state.velocityX) + Math.abs(state.velocityY);
      });
      render();
      if (energy > 0.0025) drawstringFrame = requestAnimationFrame(stepDrawstringPhysics);
      else resetPhysics();
    }

    function resetPhysics() {
      if (drawstringFrame) cancelAnimationFrame(drawstringFrame);
      drawstringFrame = 0;
      drawstringLastTime = 0;
      drawstringStates.forEach((state, index) => {
        state.angleX = 0;
        state.angleY = 0;
        state.velocityX = 0;
        state.velocityY = 0;
        drawstringPivots[index].rotation.set(0, 0, 0);
      });
      render();
    }

    function getPhysicsState() {
      return {
        active: Boolean(drawstringFrame),
        drawstrings: drawstringStates.map(state => ({ ...state }))
      };
    }


    const fabricMaps = createFabricMaps();
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    fabricMaps.colorMap.anisotropy = maxAnisotropy;
    fabricMaps.roughnessMap.anisotropy = maxAnisotropy;

    clothMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x080a0d,
      map: fabricMaps.colorMap,
      roughness: 0.98,
      roughnessMap: fabricMaps.roughnessMap,
      metalness: 0,
      clearcoat: 0,
      side: THREE.DoubleSide
    });
    const ribMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x06080a,
      map: fabricMaps.colorMap,
      roughness: 0.95,
      roughnessMap: fabricMaps.roughnessMap,
      metalness: 0,
      side: THREE.DoubleSide
    });
    const cavityMaterial = new THREE.MeshStandardMaterial({ color: 0x010203, roughness: 1, metalness: 0, side: THREE.DoubleSide });
    const cordMaterial = new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.84, metalness: 0, side: THREE.DoubleSide });
    const hardwareMaterial = new THREE.MeshStandardMaterial({ color: 0x555b61, roughness: 0.3, metalness: 0.72, side: THREE.DoubleSide });

    new THREE.GLTFLoader().load(
      window.MIZRACH_HOODIE_MODEL_DATA,
      gltf => {
        modelRoot = gltf.scene;
        modelRoot.name = 'virtualPandoraRealHoodie';
        modelRoot.matrixAutoUpdate = true;
        modelRoot.updateMatrix();

        const fleeceMeshes = [];
        const strapMeshes = [];
        modelRoot.traverse(child => {
          if (!child.isMesh) return;
          meshCount += 1;
          vertexCount += child.geometry.attributes.position ? child.geometry.attributes.position.count : 0;
          const original = Array.isArray(child.material) ? child.material[0] : child.material;
          const materialName = (original && original.name ? original.name : '').toLowerCase();
          if (materialName.includes('knit_fleece')) {
            child.material = clothMaterial;
            fleeceMeshes.push(child);
          } else if (materialName.includes('rib')) {
            child.material = ribMaterial;
          } else if (materialName.includes('strap')) {
            child.material = cordMaterial;
            strapMeshes.push(child);
          } else if (materialName.includes('hole')) {
            child.material = cavityMaterial;
          } else {
            child.material = hardwareMaterial;
          }
          child.material.needsUpdate = true;
          child.castShadow = false;
          child.receiveShadow = false;
        });
        strapMeshes.forEach(splitDrawstringMesh);

        garment.add(modelRoot);
        garment.rotation.set(0, 0, 0);
        garment.updateMatrixWorld(true);
        modelRoot.updateMatrixWorld(true);

        const rawBox = new THREE.Box3().setFromObject(modelRoot);
        const rawSize = rawBox.getSize(new THREE.Vector3());
        if (rawSize.y <= rawSize.z) throw new Error('Imported hoodie axis normalization is invalid.');
        rawModelSize = rawSize.clone();
        const scale = 4.35 / rawSize.y;
        modelRoot.scale.setScalar(scale);
        modelRoot.updateMatrix();
        modelRoot.updateMatrixWorld(true);
        const scaledBox = new THREE.Box3().setFromObject(modelRoot);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        modelRoot.position.set(-scaledCenter.x, -scaledCenter.y, -scaledCenter.z);
        modelRoot.updateMatrix();
        modelRoot.updateMatrixWorld(true);

        const fittedBox = new THREE.Box3().setFromObject(modelRoot);
        const fittedSize = fittedBox.getSize(new THREE.Vector3());
        modelFitSize = fittedSize.clone();
        fitCamera();

        if (!fleeceMeshes.length) throw new Error('Real hoodie fleece meshes were not found.');

        const logoTexture = new THREE.TextureLoader().load(window.MIZRACH_LOGO_DATA_URL, render);
        logoTexture.encoding = THREE.sRGBEncoding;
        logoTexture.anisotropy = maxAnisotropy;
        const logoMaterial = new THREE.MeshStandardMaterial({
          map: logoTexture,
          transparent: true,
          alphaTest: 0.018,
          depthWrite: false,
          roughness: 0.8,
          metalness: 0,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          side: THREE.FrontSide
        });

        garment.updateMatrixWorld(true);
        modelRoot.updateMatrixWorld(true);
        const center = fittedBox.getCenter(new THREE.Vector3());
        // Place the print on the mid chest, clear of the hood opening and drawstrings.
        const logoPosition = new THREE.Vector3(0, center.y - fittedSize.y * 0.065, fittedBox.max.z + 0.02);
        const logoSize = new THREE.Vector3(fittedSize.x * 0.5, fittedSize.y * 0.28, fittedSize.z * 1.15);
        const frontLogo = new THREE.Group();
        frontLogo.name = 'frontLogo';
        fleeceMeshes.forEach((target, index) => {
          const decalGeometry = new THREE.DecalGeometry(target, logoPosition, new THREE.Euler(0, 0, 0), logoSize);
          const count = decalGeometry.attributes.position ? decalGeometry.attributes.position.count : 0;
          decalVertexCount += count;
          if (!count) return;
          const decal = new THREE.Mesh(decalGeometry, logoMaterial);
          decal.name = `frontLogoChunk${index + 1}`;
          decal.renderOrder = 4;
          frontLogo.add(decal);
        });
        garment.add(frontLogo);

        loaded = true;
        setOrientation(currentOrientation);
        window.dispatchEvent(new CustomEvent('mizrach-hoodie-3d-ready'));
        window.dispatchEvent(new CustomEvent('mizrach-3d-ready'));
      },
      undefined,
      error => {
        console.error('Mizrach real hoodie GLB failed to load:', error);
        window.MizrachHoodie3D.ready = false;
        window.dispatchEvent(new CustomEvent('mizrach-3d-failed'));
      }
    );

    function getDebugState() {
      const bounds = new THREE.Box3().setFromObject(garment);
      return {
        modelSource: 'Virtual Pandora CC-BY GLB',
        realGarment: true,
        meshCount,
        vertexCount,
        partCount: meshCount + (garment.getObjectByName('frontLogo') ? 1 : 0),
        frontLogo: Boolean(garment.getObjectByName('frontLogo')),
        decalVertexCount,
        cleanBack: true,
        hood: true,
        kangarooPocket: true,
        pocket: true,
        drawstrings: true,
        drawstringPhysics: getPhysicsState(),
        roughness: clothMaterial.roughness,
        orientation: currentOrientation.toArray(),
        bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
        camera: { position: camera.position.toArray(), near: camera.near, far: camera.far, aspect: camera.aspect },
        modelTransform: modelRoot ? { rotation: modelRoot.rotation.toArray(), scale: modelRoot.scale.toArray(), position: modelRoot.position.toArray() } : null,
        rawModelSize: rawModelSize ? rawModelSize.toArray() : null,
        modelFitSize: modelFitSize ? modelFitSize.toArray() : null,
        canvas: { cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight, width: canvas.width, height: canvas.height },
        webglError: renderer.getContext().getError()
      };
    }

    if ('ResizeObserver' in window) new ResizeObserver(render).observe(canvas);
    else window.addEventListener('resize', render);

    window.MizrachHoodie3D = {
      ready: true,
      setRotation,
      setOrientation,
      getOrientation: () => currentOrientation.toArray(),
      applyPhysicsImpulse,
      resetPhysics,
      getPhysicsState,
      getDebugState,
      render,
      get loaded() { return loaded; }
    };
    setRotation(currentDegrees, currentPitch);
  } catch (error) {
    console.error('Mizrach real hoodie failed to initialize:', error);
    window.MizrachHoodie3D = { ready: false, loaded: false, setRotation() {}, setOrientation() {}, render() {} };
  }
})();
