(() => {
  'use strict';

  const canvas = document.querySelector('#tshirt3dCanvas');
  if (!canvas || !window.THREE || !THREE.GLTFLoader || !THREE.DecalGeometry) {
    window.MizrachShirt3D = { ready: false, setRotation() {} };
    return;
  }

  try {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.72;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
    camera.position.set(0, 0.36, 6.15);
    camera.lookAt(0, -0.16, 0);

    scene.add(new THREE.HemisphereLight(0xe8edf5, 0x050507, 0.34));
    const key = new THREE.DirectionalLight(0xfffaf3, 1.16);
    key.position.set(4.5, 6, 7);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xd7ff45, 0.14);
    rim.position.set(-5, 3, -5);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0x91a4c7, 0.25);
    fill.position.set(-4, -1, 5);
    scene.add(fill);
    const topLight = new THREE.DirectionalLight(0xfff0dc, 0.18);
    topLight.position.set(0, 8, 1.5);
    scene.add(topLight);

    const garment = new THREE.Group();
    scene.add(garment);

    let currentDegrees = -8;
    let currentPitch = 0;
    const currentOrientation = new THREE.Quaternion();
    let modelLoaded = false;
    let modelFitSize = null;

    function fitCameraToModel() {
      if (!modelFitSize) return;
      const padding = 1.2;
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const distanceForHeight = (modelFitSize.y * padding * 0.5) / Math.tan(verticalFov / 2);
      const distanceForWidth = (modelFitSize.x * padding * 0.5) / Math.tan(horizontalFov / 2);
      const distance = Math.max(distanceForHeight, distanceForWidth) + modelFitSize.z * 0.5;

      camera.position.set(0, modelFitSize.y * 0.055, distance);
      camera.lookAt(0, -modelFitSize.y * 0.035, 0);
      camera.near = Math.max(0.1, distance - modelFitSize.z * 4);
      camera.far = distance + modelFitSize.z * 8 + 10;
      camera.updateProjectionMatrix();
    }

    function resize() {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const ratio = renderer.getPixelRatio();
      if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        fitCameraToModel();
        camera.updateProjectionMatrix();
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

    function createFabricMaps() {
      const size = 128;
      const colorData = new Uint8Array(size * size * 3);
      const roughnessData = new Uint8Array(size * size * 3);
      let seed = 0x6d2b79f5;
      const random = () => {
        seed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed);
        return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
      };

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 3;
          const warp = Math.sin(x * Math.PI * 0.5) * 2.4;
          const weft = Math.sin(y * Math.PI * 0.5) * 2.0;
          const grain = (random() - 0.5) * 5;
          const fiber = Math.max(218, Math.min(250, 235 + warp + weft + grain));
          const rough = Math.max(210, Math.min(255, 238 - warp - weft + grain * 0.7));
          colorData[i] = colorData[i + 1] = colorData[i + 2] = fiber;
          roughnessData[i] = roughnessData[i + 1] = roughnessData[i + 2] = rough;
        }
      }

      const colorMap = new THREE.DataTexture(colorData, size, size, THREE.RGBFormat);
      colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
      colorMap.repeat.set(4, 6);
      colorMap.encoding = THREE.sRGBEncoding;
      colorMap.needsUpdate = true;

      const roughnessMap = new THREE.DataTexture(roughnessData, size, size, THREE.RGBFormat);
      roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
      roughnessMap.repeat.set(4, 6);
      roughnessMap.needsUpdate = true;
      return { colorMap, roughnessMap };
    }

    const gltfLoader = new THREE.GLTFLoader();
    gltfLoader.load(
      window.MIZRACH_SHIRT_MODEL_DATA_URL,
      gltf => {
        const model = gltf.scene;
        let shirtMesh = model.getObjectByName('T_Shirt_male');
        if (!shirtMesh || !shirtMesh.isMesh) {
          model.traverse(child => { if (!shirtMesh && child.isMesh) shirtMesh = child; });
        }
        if (!shirtMesh) throw new Error('T-shirt mesh was not found in the GLB.');

        const sourceMaterial = Array.isArray(shirtMesh.material) ? shirtMesh.material[0] : shirtMesh.material;
        const fabricMaps = createFabricMaps();
        const clothMaterial = new THREE.MeshPhysicalMaterial({
          color: 0x07090d,
          map: fabricMaps.colorMap,
          roughness: 1,
          roughnessMap: fabricMaps.roughnessMap,
          metalness: 0,
          normalMap: sourceMaterial.normalMap || null,
          normalScale: new THREE.Vector2(0.92, 0.92),
          aoMap: sourceMaterial.aoMap || null,
          aoMapIntensity: 1.08,
          clearcoat: 0,
          side: THREE.DoubleSide
        });

        [clothMaterial.map, clothMaterial.roughnessMap, clothMaterial.normalMap, clothMaterial.aoMap].forEach(texture => {
          if (texture) texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        });

        model.traverse(child => {
          if (!child.isMesh) return;
          const geometry = child.geometry;
          if (geometry.attributes.uv && !geometry.attributes.uv2) {
            geometry.setAttribute('uv2', geometry.attributes.uv.clone());
          }
          child.material = clothMaterial;
          child.castShadow = false;
          child.receiveShadow = false;
        });

        garment.add(model);
        // DecalGeometry emits world-space vertices. Build it while the garment
        // is neutral so the decal and shirt receive rotation exactly once.
        garment.rotation.set(0, 0, 0);
        garment.updateMatrixWorld(true);
        model.updateMatrixWorld(true);
        const rawBox = new THREE.Box3().setFromObject(model);
        const rawSize = rawBox.getSize(new THREE.Vector3());
        const rawCenter = rawBox.getCenter(new THREE.Vector3());
        const scale = 3.85 / rawSize.y;
        model.scale.setScalar(scale);
        model.position.set(-rawCenter.x * scale, -rawCenter.y * scale, -rawCenter.z * scale);
        model.updateMatrixWorld(true);

        const fittedBox = new THREE.Box3().setFromObject(model);
        const fittedSize = fittedBox.getSize(new THREE.Vector3());
        modelFitSize = fittedSize.clone();
        fitCameraToModel();

        const logoTexture = new THREE.TextureLoader().load(window.MIZRACH_LOGO_DATA_URL, render);
        logoTexture.encoding = THREE.sRGBEncoding;
        logoTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

        const logoMaterial = new THREE.MeshStandardMaterial({
          map: logoTexture,
          transparent: true,
          alphaTest: 0.018,
          depthWrite: false,
          roughness: 0.74,
          metalness: 0.015,
          polygonOffset: true,
          polygonOffsetFactor: -4
        });

        const logoPosition = new THREE.Vector3(0, fittedBox.getCenter(new THREE.Vector3()).y + fittedSize.y * 0.11, fittedBox.max.z + 0.015);
        const logoOrientation = new THREE.Euler(0, 0, 0);
        const logoSize = new THREE.Vector3(fittedSize.x * 0.57, fittedSize.y * 0.37, fittedSize.z * 1.35);
        const decal = new THREE.Mesh(new THREE.DecalGeometry(shirtMesh, logoPosition, logoOrientation, logoSize), logoMaterial);
        garment.add(decal);

        modelLoaded = true;
        setOrientation(currentOrientation);
        window.dispatchEvent(new CustomEvent('mizrach-3d-ready'));
      },
      undefined,
      error => {
        console.error('Mizrach GLB shirt failed to load:', error);
        window.MizrachShirt3D.ready = false;
        window.dispatchEvent(new CustomEvent('mizrach-3d-failed'));
      }
    );

    if ('ResizeObserver' in window) new ResizeObserver(render).observe(canvas);
    else window.addEventListener('resize', render);

    window.MizrachShirt3D = {
      ready: true,
      setRotation,
      setOrientation,
      getOrientation: () => currentOrientation.toArray(),
      render,
      get loaded() { return modelLoaded; }
    };
    setRotation(currentDegrees, currentPitch);
  } catch (error) {
    console.error('Mizrach 3D shirt failed to initialize:', error);
    window.MizrachShirt3D = { ready: false, setRotation() {} };
  }
})();
