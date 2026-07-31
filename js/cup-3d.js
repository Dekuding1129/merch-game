(() => {
  'use strict';

  const canvas = document.querySelector('#cup3dCanvas');
  if (!canvas || !window.THREE || !window.MIZRACH_LOGO_DATA_URL) {
    window.MizrachCup3D = { ready: false, setRotation() {}, render() {} };
    return;
  }

  try {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.84;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(29, 1, 0.1, 40);

    scene.add(new THREE.HemisphereLight(0xf8fbff, 0x17181b, 0.78));
    const key = new THREE.DirectionalLight(0xffffff, 1.55);
    key.position.set(4.5, 6.5, 7);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xaec4e8, 0.42);
    fill.position.set(-4, 1.5, 5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xd7ff45, 0.2);
    rim.position.set(-5, 3, -4);
    scene.add(rim);
    const top = new THREE.DirectionalLight(0xfff1dd, 0.42);
    top.position.set(0, 8, 2);
    scene.add(top);

    const cup = new THREE.Group();
    cup.rotation.x = THREE.MathUtils.degToRad(-1.5);
    scene.add(cup);

    function makePowderCoatMap() {
      const size = 128;
      const data = new Uint8Array(size * size * 3);
      let seed = 0x23b7a51d;
      const random = () => {
        seed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed);
        return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
      };
      for (let i = 0; i < data.length; i += 3) {
        const value = Math.round(225 + random() * 24);
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
      }
      const texture = new THREE.DataTexture(data, size, size, THREE.RGBFormat);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(3, 6);
      texture.encoding = THREE.sRGBEncoding;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;
      return texture;
    }

    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x07090c,
      map: makePowderCoatMap(),
      roughness: 0.68,
      metalness: 0.04,
      clearcoat: 0.08,
      clearcoatRoughness: 0.78,
      side: THREE.DoubleSide
    });
    const lidMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x050608,
      roughness: 0.28,
      metalness: 0.08,
      clearcoat: 0.34,
      clearcoatRoughness: 0.24
    });
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x15181d,
      roughness: 0.4,
      metalness: 0.12
    });

    const profile = [
      new THREE.Vector2(0.69, -1.63),
      new THREE.Vector2(0.68, -1.59),
      new THREE.Vector2(0.7, -1.52),
      new THREE.Vector2(0.735, -0.55),
      new THREE.Vector2(0.77, 0.52),
      new THREE.Vector2(0.8, 1.27),
      new THREE.Vector2(0.795, 1.36)
    ];
    const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 128), bodyMaterial);
    cup.add(body);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.69, 0.68, 0.055, 96), edgeMaterial);
    base.position.y = -1.63;
    cup.add(base);

    const lidCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.825, 0.795, 0.16, 96), lidMaterial);
    lidCollar.position.y = 1.43;
    cup.add(lidCollar);

    const lidRim = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.026, 14, 128), edgeMaterial);
    lidRim.rotation.x = Math.PI / 2;
    lidRim.position.y = 1.35;
    cup.add(lidRim);

    const lidTop = new THREE.Mesh(new THREE.CylinderGeometry(0.79, 0.82, 0.075, 96), lidMaterial);
    lidTop.position.y = 1.545;
    cup.add(lidTop);

    const lidInset = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.012, 96), lidMaterial);
    lidInset.position.y = 1.59;
    cup.add(lidInset);

    const slider = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.026, 0.13), lidMaterial);
    slider.position.set(0, 1.61, 0.19);
    cup.add(slider);

    const logoTexture = new THREE.TextureLoader().load(window.MIZRACH_LOGO_DATA_URL, render);
    logoTexture.encoding = THREE.sRGBEncoding;
    logoTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const logoMaterial = new THREE.MeshStandardMaterial({
      map: logoTexture,
      transparent: true,
      alphaTest: 0.018,
      depthWrite: false,
      roughness: 0.58,
      metalness: 0.01,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      side: THREE.DoubleSide
    });
    const logo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.776, 0.748, 0.82, 96, 1, true, -0.75, 1.5),
      logoMaterial
    );
    logo.position.y = -0.04;
    cup.add(logo);

    const fitSize = new THREE.Vector3(1.72, 3.28, 1.72);
    let currentDegrees = -8;
    let currentPitch = 0;
    const currentOrientation = new THREE.Quaternion();

    function fitCamera() {
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const distanceY = (fitSize.y * 1.13 * 0.5) / Math.tan(verticalFov / 2);
      const distanceX = (fitSize.x * 1.18 * 0.5) / Math.tan(horizontalFov / 2);
      const distance = Math.max(distanceY, distanceX) + fitSize.z * 0.45;
      camera.position.set(0, 0.05, distance);
      camera.lookAt(0, -0.03, 0);
      camera.near = Math.max(0.1, distance - 5);
      camera.far = distance + 12;
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
      cup.quaternion.copy(currentOrientation);
      render();
    }

    function setOrientation(quaternion) {
      currentOrientation.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w).normalize();
      cup.quaternion.copy(currentOrientation);
      render();
    }

    if ('ResizeObserver' in window) new ResizeObserver(render).observe(canvas);
    else window.addEventListener('resize', render);

    window.MizrachCup3D = {
      ready: true,
      loaded: true,
      setRotation,
      setOrientation,
      getOrientation: () => currentOrientation.toArray(),
      render
    };
    setRotation(currentDegrees, currentPitch);
    window.dispatchEvent(new CustomEvent('mizrach-cup-3d-ready'));
  } catch (error) {
    console.error('Mizrach tumbler failed to initialize:', error);
    window.MizrachCup3D = { ready: false, setRotation() {}, render() {} };
  }
})();
