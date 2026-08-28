// Signature products use continuous local WebGL models; remaining products retain lightweight SVG placeholders.
    const products = [
      {
        name: 'Mizrach Pinaz T-Shirt', rarity: 'Signature', price: 42, stock: 'In stock', color: '#111111', print: '#d9a514', kind: 'tee',
        model3d: 'shirt',
        optionLabel: 'Select size', options: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
        fallbackImage: 'images/tshirt/preview.png',

        description: 'Premium black cotton T-shirt with the gold-and-white Mizrach Pinaz wing graphic and a clean back.',
        specs: [['Fabric', 'Premium cotton'], ['Print', 'High quality'], ['Finish', 'Durable stitching']]
      },
      {
        name: 'Mizrach Pinaz Tumbler', rarity: 'Signature', price: 28, stock: 'In stock', color: '#08090c', print: '#d9a514', kind: 'tumbler',
        model3d: 'cup',
        optionLabel: 'Select option', options: ['One size'],
        fallbackImage: 'images/tumbler/preview.png',

        description: 'Matte-black tapered travel tumbler with a low-profile lid and the gold-and-white Mizrach Pinaz wing graphic.',
        specs: [['Finish', 'Matte black'], ['Lid', 'Low profile'], ['Print', 'Front graphic']]
      },
      {
        name: 'Mizrach Pinaz Hoodie', rarity: 'Signature', price: 68, stock: 'In stock', color: '#080a0d', print: '#d9a514', kind: 'hoodie',
        model3d: 'hoodie',
        optionLabel: 'Select size', options: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
        description: 'Black pullover hoodie with a dimensional hood, kangaroo pocket, drawstrings, and front-only Mizrach Pinaz artwork.',
        specs: [['Finish', 'Black fleece'], ['Construction', 'Pullover hood'], ['Print', 'Front graphic']]
      },
      {
        name: 'Mizrach Pinaz Keychain', rarity: 'Signature', price: 18, stock: 'In stock', color: '#050607', print: '#d9a514', kind: 'keychain',
        model3d: 'keychain',
        optionLabel: 'Select option', options: ['One size'],

        description: 'Round black Mizrach Pinaz keychain with a polished metal rim, linked chain, split ring, and front artwork.',
        specs: [['Finish', 'Gloss black'], ['Hardware', 'Metal ring and chain'], ['Print', 'Front graphic']]
      }
    ];

    const els = {
      list: document.querySelector('#productList'), product: document.querySelector('#product'), productLoader: document.querySelector('#productLoader'), art: document.querySelector('#productArt'),
      frame: document.querySelector('#productFrame'), shirtCanvas: document.querySelector('#tshirt3dCanvas'), cupCanvas: document.querySelector('#cup3dCanvas'), hoodieCanvas: document.querySelector('#hoodie3dCanvas'), keychainCanvas: document.querySelector('#keychain3dCanvas'),
      viewer: document.querySelector('#viewer'), stage: document.querySelector('#stageNumber'), rarity: document.querySelector('#rarity'),
      name: document.querySelector('#productName'), description: document.querySelector('#description'), price: document.querySelector('#price'),
      stock: document.querySelector('#stock'), specs: document.querySelector('#specs'), size: document.querySelector('#size'), optionLabel: document.querySelector('label[for="size"]'), equip: document.querySelector('#equip'),
      cartButton: document.querySelector('#cartButton'), cartCount: document.querySelector('#cartCount'), cartPanel: document.querySelector('#cartPanel'),
      closeCart: document.querySelector('#closeCart'), cartItems: document.querySelector('#cartItems'), toast: document.querySelector('#toast'),
      toastMessage: document.querySelector('#toastMessage'), pagination: document.querySelector('#productPagination'), soundToggle: document.querySelector('#soundToggle'),
      purchase: document.querySelector('#purchasePanel'), tickerTrack: document.querySelector('#tickerTrack'), detailHotspots: document.querySelector('.detail-hotspots'),
      mobileDock: document.querySelector('#mobilePurchaseDock'), mobileDockName: document.querySelector('#mobileDockName'), mobileDockPrice: document.querySelector('#mobileDockPrice'),
      mobileDockAction: document.querySelector('#mobileDockAction'), deliveryModal: document.querySelector('#deliveryModal'), deliveryForm: document.querySelector('#deliveryForm'), closeDelivery: document.querySelector('#closeDelivery'), cancelDelivery: document.querySelector('#cancelDelivery')
    };

    let active = 0;
    let rotation = -8;
    let pitch = 0;
    let dragging = false;
    let handleDragging = false;
    let dragStart = 0;
    let dragStartY = 0;
    let rotationStart = 0;
    let pitchStart = 0;
    const cart = [];
    let deliveryDetails = null;
    const apiBase = new URLSearchParams(window.location.search).get('api') || `${window.location.protocol}//${window.location.hostname}:8787`;
    let activeFrames = [];
    let sequenceToken = 0;
    let usingStaticPreview = false;
    let using3D = false;
    let active3DRenderer = null;
    const LOADOUT_EXIT_MS = 200;
    const LOADOUT_ENTER_MS = 760;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const forceFullMotion = new URLSearchParams(window.location.search).get('motion') === 'full';
    const physicsAllowed = forceFullMotion || !reducedMotion.matches;
    document.documentElement.classList.toggle('force-full-motion', forceFullMotion);
    let selectionSoundEnabled = false;
    let audioContext = null;

    let transitionToken = 0;
    const orientation = new THREE.Quaternion();
    const orientationStart = new THREE.Quaternion();
    const trackballStart = new THREE.Vector3();
    const angularVelocity = new THREE.Vector3();
    const lastDragOrientation = new THREE.Quaternion();
    const dragChange = new THREE.Quaternion();
    const dragInverse = new THREE.Quaternion();
    const inertiaDelta = new THREE.Quaternion();
    const inertiaAxis = new THREE.Vector3();
    const instantaneousVelocity = new THREE.Vector3();
    let lastDragTime = 0;
    let inertiaLastTime = 0;
    let inertiaFrame = 0;
    let viewSnapFrame = 0;
    const readyEvents = {
      shirt: 'mizrach-3d-ready',
      cup: 'mizrach-cup-3d-ready',
      hoodie: 'mizrach-hoodie-3d-ready',
      keychain: 'mizrach-keychain-3d-ready'
    };

    function setProductLoading(loading) {
      els.viewer.classList.toggle('is-loading', loading);
      els.productLoader.hidden = !loading;
      els.viewer.setAttribute('aria-busy', String(loading));
    }
    const PRODUCT_VIEW_ANGLES = {
      top: { x: 42, y: 0 },
      side: { x: 0, y: 90 },
      bottom: { x: -52, y: 0 }
    };
    const snapStartOrientation = new THREE.Quaternion();
    const snapTargetOrientation = new THREE.Quaternion();

    function resetOrientation() {
      orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(8));
    }

    function stopViewSnap() {
      if (viewSnapFrame) cancelAnimationFrame(viewSnapFrame);
      viewSnapFrame = 0;
    }

    function setProductViewState(view = '') {
      if (view) els.viewer.dataset.view = view;
      else delete els.viewer.dataset.view;
      els.detailHotspots.querySelectorAll('[data-view]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.view === view));
      });
    }

    function moveProductToView(view) {
      const angles = PRODUCT_VIEW_ANGLES[view];
      if (!angles) return;
      stopInertia();
      stopViewSnap();
      if (handleDragging) active3DRenderer?.endHandleDrag?.(true);
      handleDragging = false;
      dragging = false;
      active3DRenderer?.resetPhysics?.();
      angularVelocity.set(0, 0, 0);
      rotation = angles.y;
      pitch = angles.x;
      snapStartOrientation.copy(orientation);
      snapTargetOrientation.setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(angles.x),
        THREE.MathUtils.degToRad(angles.y),
        0,
        'XYZ'
      ));
      setProductViewState(view);

      if (!physicsAllowed) {
        orientation.copy(snapTargetOrientation);
        updateRotation();
        return;
      }

      const startedAt = performance.now();
      const duration = 520;
      const step = now => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        orientation.slerpQuaternions(snapStartOrientation, snapTargetOrientation, eased);
        updateRotation();
        if (progress < 1) viewSnapFrame = requestAnimationFrame(step);
        else viewSnapFrame = 0;
      };
      viewSnapFrame = requestAnimationFrame(step);
    }


    function projectToTrackball(event) {
      const rect = els.viewer.getBoundingClientRect();
      const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.5);
      let x = (event.clientX - (rect.left + rect.width * 0.5)) / radius;
      let y = ((rect.top + rect.height * 0.5) - event.clientY) / radius;
      const lengthSquared = x * x + y * y;
      let z;
      if (lengthSquared > 1) {
        const scale = 1 / Math.sqrt(lengthSquared);
        x *= scale;
        y *= scale;
        z = 0;
      } else {
        z = Math.sqrt(1 - lengthSquared);
      }
      return new THREE.Vector3(x, y, z).normalize();
    }

    function rotateOrientation(axis, degrees) {
      stopViewSnap();
      setProductViewState();
      const delta = new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(degrees));
      orientation.premultiply(delta).normalize();
      updateRotation();
    }

    function stopInertia() {
      if (inertiaFrame) cancelAnimationFrame(inertiaFrame);
      inertiaFrame = 0;
      inertiaLastTime = 0;
      angularVelocity.set(0, 0, 0);
    }

    function sampleDragVelocity(now) {
      if (!physicsAllowed || !lastDragTime) {
        lastDragTime = now;
        lastDragOrientation.copy(orientation);
        return;
      }
      const dt = Math.max(1 / 240, Math.min(0.05, (now - lastDragTime) / 1000));
      dragInverse.copy(lastDragOrientation).conjugate();
      dragChange.copy(orientation).multiply(dragInverse).normalize();
      if (dragChange.w < 0) dragChange.set(-dragChange.x, -dragChange.y, -dragChange.z, -dragChange.w);
      const angle = 2 * Math.acos(THREE.MathUtils.clamp(dragChange.w, -1, 1));
      const divisor = Math.sqrt(Math.max(1e-8, 1 - dragChange.w * dragChange.w));
      if (angle > 1e-5) {
        inertiaAxis.set(dragChange.x / divisor, dragChange.y / divisor, dragChange.z / divisor).normalize();
        instantaneousVelocity.copy(inertiaAxis).multiplyScalar(angle / dt);
        if (instantaneousVelocity.length() > 8) instantaneousVelocity.setLength(8);
        angularVelocity.lerp(instantaneousVelocity, 0.42);
      }
      lastDragTime = now;
      lastDragOrientation.copy(orientation);
      active3DRenderer.applyPhysicsImpulse?.(angularVelocity);
    }

    function stepInertia(now) {
      if (!physicsAllowed || dragging || !using3D || !active3DRenderer) {
        stopInertia();
        return;
      }
      if (!inertiaLastTime) inertiaLastTime = now;
      const dt = Math.max(1 / 240, Math.min(0.033, (now - inertiaLastTime) / 1000));
      inertiaLastTime = now;
      const speed = angularVelocity.length();
      if (speed < 0.035) {
        stopInertia();
        return;
      }
      inertiaAxis.copy(angularVelocity).normalize();
      inertiaDelta.setFromAxisAngle(inertiaAxis, speed * dt);
      orientation.premultiply(inertiaDelta).normalize();
      updateRotation();
      active3DRenderer.applyPhysicsImpulse?.(angularVelocity);
      angularVelocity.multiplyScalar(Math.exp(-5.2 * dt));
      inertiaFrame = requestAnimationFrame(stepInertia);
    }

    function startInertia() {
      if (!physicsAllowed || !using3D || angularVelocity.length() < 0.035) {
        stopInertia();
        return;
      }
      if (inertiaFrame) cancelAnimationFrame(inertiaFrame);
      inertiaLastTime = 0;
      inertiaFrame = requestAnimationFrame(stepInertia);
    }

    function rendererFor(product) {
      if (!product || !product.model3d) return null;
      if (product.model3d === 'shirt') return window.MizrachShirt3D || null;
      if (product.model3d === 'cup') return window.MizrachCup3D || null;
      if (product.model3d === 'hoodie') return window.MizrachHoodie3D || null;
      if (product.model3d === 'keychain') return window.MizrachKeychain3D || null;
      return null;
    }

    function canvasFor(product) {
      if (!product) return null;
      if (product.model3d === 'shirt') return els.shirtCanvas;
      if (product.model3d === 'cup') return els.cupCanvas;
      if (product.model3d === 'hoodie') return els.hoodieCanvas;
      if (product.model3d === 'keychain') return els.keychainCanvas;
      return null;
    }

    function buildFrameUrls({ basePath, frameCount, extension = 'webp' }) {
      return Array.from(
        { length: frameCount },
        (_, index) => `${basePath}${String(index).padStart(3, '0')}.${extension}`
      );
    }

    function showFallback(product = products[active]) {
      setProductLoading(true);
      activeFrames = [];
      active3DRenderer = rendererFor(product);
      const activeCanvas = canvasFor(product);
      using3D = Boolean(active3DRenderer && active3DRenderer.ready && activeCanvas);
      els.product.classList.remove('has-frames', 'has-3d');
      [els.shirtCanvas, els.cupCanvas, els.hoodieCanvas, els.keychainCanvas].forEach(canvas => {
        canvas.hidden = true;
        canvas.classList.remove('is-active');
      });
      if (using3D) {
        usingStaticPreview = false;
        activeCanvas.hidden = false;
        activeCanvas.classList.add('is-active');
        els.frame.hidden = true;
        els.art.hidden = true;
        els.product.classList.add('has-3d');
        active3DRenderer.render();
        if (active3DRenderer.loaded) setProductLoading(false);
        return;
      }
      active3DRenderer = null;
      usingStaticPreview = Boolean(product && product.fallbackImage);
      if (usingStaticPreview) {
        els.frame.alt = `${product.name}, front view`;
        els.frame.onload = () => {
          if (products[active] === product) setProductLoading(false);
        };
        els.frame.onerror = () => {
          if (products[active] === product) setProductLoading(false);
        };
        els.frame.src = product.fallbackImage;
        els.frame.hidden = false;
        els.art.hidden = true;
        els.product.classList.add('has-frames');
      } else {
        els.frame.hidden = true;
        els.frame.removeAttribute('src');
        els.art.hidden = false;
        setProductLoading(false);
      }
    }

    function loadFrame(url) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
      });
    }

    function preloadFrameSequence(product) {
      const token = ++sequenceToken;
      showFallback(product);
      if (!product.frames) return;

      const urls = buildFrameUrls(product.frames);
      Promise.all(urls.map(loadFrame))
        .then(images => {
          if (token !== sequenceToken || product !== products[active]) return;
          activeFrames = images;
          usingStaticPreview = false;
          els.frame.hidden = false;
          els.art.hidden = true;
          els.product.classList.add('has-frames');
          els.frame.alt = `${product.name}, 360-degree product view`;
          renderFrame();
        })
        .catch(() => {
          if (token === sequenceToken) showFallback(product);
        });
    }

    function renderFrame() {
      if (!activeFrames.length) return;
      const normalized = ((rotation % 360) + 360) % 360;
      const index = Math.round((normalized / 360) * activeFrames.length) % activeFrames.length;
      const frame = activeFrames[index];
      if (els.frame.src !== frame.src) els.frame.src = frame.src;
    }

    function artFor(kind) {
      const commonPrint = `<g class="print"><rect x="214" y="245" width="72" height="72" rx="3"/><path d="M230 262h40v8h-40zm0 16h28v8h-28zm0 16h40v8h-40z" fill="var(--product-color)"/></g>`;
      if (kind === 'hoodie') return `<path class="fabric" d="M177 128q73-64 146 0l38 34 76 50-47 93-51-27 14 236H147l14-236-51 27-47-93 76-50z"/><path class="shade" d="M177 128q73 50 146 0l-15 106-58 24-58-24z"/><path class="stitch" d="M165 278l-10 222m180-222 10 222"/>${commonPrint}<path class="print" d="M212 124q38-54 76 0l-15 55h-46z"/>`;
      if (kind === 'cap') return `<path class="fabric" d="M119 292q15-135 140-135 117 0 136 127l-13 50H129z"/><path class="shade" d="M119 292q134-35 276-8l-13 50H129z"/><path class="fabric" d="M233 325q151-11 215 36-102 47-248 9z"/><path class="stitch" d="M143 278q111-34 230-7M258 160v158"/><path class="print" d="M226 220h62v62h-62z"/><path d="M239 232h36v8h-36zm0 15h24v8h-24zm0 15h36v8h-36z" fill="var(--product-color)"/>`;
      if (kind === 'jacket') return `<path class="fabric" d="M173 120h154l35 40 76 59-48 93-54-28 14 234H150l14-234-54 28-48-93 76-59z"/><path class="shade" d="M244 120h12l23 398h-58z"/><path class="stitch" d="M175 302h61v90h-68m157-90h-61v90h68M250 128v380"/><path class="print" d="M276 194h48v80h-48z"/><path d="M285 207h30v7h-30zm0 14h20v7h-20zm0 14h30v7h-30z" fill="var(--product-color)"/>`;
      return `<path class="fabric" d="M176 117h148l34 34 91 54-51 102-66-33 18 243H150l18-243-66 33-51-102 91-54z"/><path class="shade" d="M176 117q74 55 148 0l-8 45q-66 35-132 0z"/><path class="stitch" d="M167 277l-10 226m176-226 10 226"/>${commonPrint}`;
    }

    function updateProductPagination() {
      els.pagination.textContent = `${String(active + 1).padStart(2, '0')} / ${String(products.length).padStart(2, '0')}`;
      if (!window.matchMedia('(max-width: 700px)').matches) return;
      requestAnimationFrame(() => {
        const selected = els.list.querySelector(`[data-index="${active}"]`);
        selected?.scrollIntoView({ behavior: physicsAllowed ? 'smooth' : 'auto', block: 'nearest', inline: 'start' });
      });
    }

    function playSelectionSound() {
      if (!selectionSoundEnabled) return;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioContext ||= new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(285, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.055);
      gain.gain.setValueAtTime(0.025, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.08);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.08);
    }

    function updateMobileDock(p = products[active]) {
      const available = p.price != null;
      els.mobileDockName.textContent = p.name;
      els.mobileDockPrice.textContent = available ? `$${p.price}` : 'Coming soon';
      els.mobileDockAction.textContent = available ? 'BUY' : 'Notify me';
      els.mobileDock.classList.toggle('is-unavailable', !available);
    }

    function updateTicker(p = products[active]) {
      const material = p.specs[0]?.[1] || 'Material archive';
      const release = p.price == null ? 'Release date: TBA' : 'Ready to equip';
      const items = [`Drop 001 · ${String(active + 1).padStart(2, '0')}/${String(products.length).padStart(2, '0')}`, material, 'Worldwide shipping', p.stock, release];
      const sequence = items.map(item => `<span>${item}</span>`).join('');
      els.tickerTrack.innerHTML = sequence + sequence;
    }


    function renderList() {
      els.list.innerHTML = products.map((p, i) => `<button class="select-item ${i === active ? 'active' : ''}" data-index="${i}" aria-current="${i === active ? 'true' : 'false'}"><span class="select-item__num">${String(i + 1).padStart(2, '0')}</span><span class="select-item__swatch" style="--swatch:${p.color}" aria-hidden="true"></span><span class="select-item__name">${p.name}</span><span class="select-item__rarity">${p.rarity}</span></button>`).join('');
      updateProductPagination();
    }

    function selectProduct(index, immediate = false) {
      stopInertia();
      stopViewSnap();
      setProductViewState();
      if (handleDragging) active3DRenderer.endHandleDrag?.(true);
      handleDragging = false;
      active3DRenderer?.resetPhysics?.();
      const next = (index + products.length) % products.length;
      if (!immediate && next === active) return;
      active = next;
      const p = products[active];
      const available = p.price != null;
      if (!immediate) playSelectionSound();
      const update = () => {
        showFallback(p);
        els.art.innerHTML = artFor(p.kind);
        els.product.style.setProperty('--product-color', p.color);
        els.product.style.setProperty('--product-print', p.print);
        els.stage.textContent = `0${active + 1}`;
        els.rarity.textContent = `${p.rarity} / 0${active + 1}`;
        els.name.textContent = p.name;
        els.description.textContent = p.description;
        els.price.textContent = p.price == null ? 'TBD' : `$${p.price}`;
        els.stock.textContent = p.stock;
        els.specs.innerHTML = p.specs.map(([key, value]) => `<div class="spec"><dt>${key}</dt><dd>${value}</dd></div>`).join('');

        els.optionLabel.textContent = available ? p.optionLabel : 'Release status';
        els.size.innerHTML = available
          ? `<option value="">Choose option...</option>${p.options.map(option => `<option>${option}</option>`).join('')}`
          : '<option value="">Not available yet</option>';
        els.size.value = '';
        els.size.disabled = !available;
        els.purchase.classList.toggle('is-unavailable', !available);
        els.equip.textContent = available ? 'BUY' : 'Notify me';
        els.equip.dataset.mode = available ? 'equip' : 'notify';
        updateMobileDock(p);
        updateTicker(p);
        rotation = -8;
        pitch = 0;
        resetOrientation();
        active3DRenderer?.resetPhysics?.();
        updateRotation();
        renderList();
        preloadFrameSequence(p);
      };

      const token = ++transitionToken;
      if (immediate || (reducedMotion.matches && !forceFullMotion)) {
        els.product.classList.remove('switching-out', 'switching-in');
        update();
        return;
      }

      renderList();
      els.product.classList.remove('switching-out', 'switching-in');
      void els.product.offsetWidth;
      els.product.classList.add('switching-out');
      setTimeout(() => {
        if (token !== transitionToken) return;
        update();
        els.product.classList.remove('switching-out');
        void els.product.offsetWidth;
        els.product.classList.add('switching-in');
        setTimeout(() => {
          if (token === transitionToken) els.product.classList.remove('switching-in');
        }, LOADOUT_ENTER_MS);
      }, LOADOUT_EXIT_MS);
    }

    function updateRotation() {
      const shadowShift = THREE.MathUtils.clamp(orientation.y * 52, -18, 18);
      const shadowScale = 1 - Math.min(0.16, Math.abs(orientation.x) * 0.22);
      els.viewer.style.setProperty('--ground-shift', `${shadowShift.toFixed(1)}px`);
      els.viewer.style.setProperty('--ground-scale', shadowScale.toFixed(3));
      if (using3D) {
        active3DRenderer.setOrientation(orientation);
        els.product.style.transform = 'none';
        els.product.setAttribute('aria-label', `${products[active].name}, unrestricted trackball orientation. Drag in any direction to rotate freely.`);
      } else if (activeFrames.length) {
        renderFrame();
        els.product.style.transform = 'none';
        els.product.setAttribute('aria-label', `${products[active].name}, frame ${Math.round(((rotation % 360) + 360) % 360)} degrees. Drag to rotate.`);
      } else if (usingStaticPreview) {
        els.product.style.transform = 'none';
        els.product.setAttribute('aria-label', `${products[active].name}, front preview. Drag to rotate.`);
      } else {
        const matrix = new THREE.Matrix4().makeRotationFromQuaternion(orientation);
        els.product.style.transform = `perspective(900px) matrix3d(${matrix.elements.join(',')})`;
        els.product.setAttribute('aria-label', `${products[active].name} fallback placeholder, rotated ${Math.round(rotation)}° horizontal and ${Math.round(pitch)}° vertical. Drag to inspect.`);
      }
    }

    function addToCart() {
      const p = products[active];
      if (p.price == null) {
        const watchlist = new Set(JSON.parse(localStorage.getItem('lootDropWatchlist') || '[]'));
        watchlist.add(p.name);
        localStorage.setItem('lootDropWatchlist', JSON.stringify([...watchlist]));
        els.equip.textContent = 'Watching';
        els.mobileDockAction.textContent = 'Watching';
        els.toast.querySelector('strong').textContent = 'Drop watch saved';
        els.toastMessage.textContent = `${p.name} saved on this device. Connect email delivery before launch.`;
      } else if (!els.size.value) {
        els.size.focus();
        els.toastMessage.textContent = 'Choose an option before equipping.';
        els.toast.querySelector('strong').textContent = 'Option required';
      } else {
        openDeliveryForm();
        return;
      }
      els.toast.classList.add('show');
      clearTimeout(addToCart.toastTimer);
      addToCart.toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2600);
    }

    function openDeliveryForm() {
      els.deliveryModal.hidden = false;
      els.deliveryModal.classList.add('open');
      els.deliveryForm.elements.name.focus();
    }

    function closeDeliveryForm() {
      els.deliveryModal.classList.remove('open');
      els.deliveryModal.hidden = true;
    }

    async function saveDeliveryDetails(event) {
      event.preventDefault();
      const delivery = Object.fromEntries(new FormData(els.deliveryForm).entries());
      const p = products[active];
      const sku = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const submit = els.deliveryForm.querySelector('[type="submit"]');
      submit.disabled = true;
      submit.textContent = 'Checking…';
      let response;
      try {
        response = await fetch(`${apiBase}/api/checkout/quote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ sku, quantity: 1, option: els.size.value }], delivery }) });
      } catch {
        submit.disabled = false;
        submit.textContent = 'Continue — BUY';
        els.toast.querySelector('strong').textContent = 'Backend unavailable';
        els.toastMessage.textContent = 'Start the local backend, then try BUY again.';
        els.toast.classList.add('show');
        return;
      }
      const result = await response.json();
      if (!response.ok) {
        submit.disabled = false;
        submit.textContent = 'Continue — BUY';
        els.toast.querySelector('strong').textContent = 'Could not continue';
        els.toastMessage.textContent = result.error || 'Check the delivery details and try again.';
        els.toast.classList.add('show');
        return;
      }
      deliveryDetails = delivery;
      cart.push({ ...p, option: els.size.value });
      els.cartCount.textContent = cart.length;
      renderCart();
      closeDeliveryForm();
      els.toast.querySelector('strong').textContent = 'Details captured';
      els.toastMessage.textContent = `${p.name} added. Demo reference: ${result.checkout.id}. No payment taken.`;
      els.toast.classList.add('show');
      clearTimeout(addToCart.toastTimer);
      addToCart.toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200);
    }

    function renderCart() {
      els.cartItems.innerHTML = cart.length ? cart.map((item, i) => `<div class="cart-item"><div><strong>${item.name}</strong><br><span>${item.option} · Item 0${i + 1}</span></div><strong>${item.price == null ? 'TBD' : `$${item.price}`}</strong></div>`).join('') : '<p class="cart-empty">Inventory empty.<br>Pick your gear and enter the next level.</p>';
    }

    function toggleCart(open) {
      els.cartPanel.classList.toggle('open', open);
      els.cartPanel.setAttribute('aria-hidden', String(!open));
      els.cartButton.setAttribute('aria-expanded', String(open));
      if (open) els.closeCart.focus();
    }

    els.list.addEventListener('click', e => { const button = e.target.closest('[data-index]'); if (button) selectProduct(Number(button.dataset.index)); });
    els.equip.addEventListener('click', addToCart);
    els.cartButton.addEventListener('click', () => toggleCart(true));
    els.closeCart.addEventListener('click', () => toggleCart(false));

    els.soundToggle.addEventListener('click', () => {
      selectionSoundEnabled = !selectionSoundEnabled;
      els.soundToggle.setAttribute('aria-pressed', String(selectionSoundEnabled));
      els.soundToggle.lastChild.textContent = ` Selection sound: ${selectionSoundEnabled ? 'on' : 'off'}`;
      playSelectionSound();
    });
    els.detailHotspots.addEventListener('pointerdown', event => event.stopPropagation());
    els.detailHotspots.addEventListener('click', event => {
      const button = event.target.closest('[data-view]');
      if (button) moveProductToView(button.dataset.view);
    });

    els.mobileDockAction.addEventListener('click', addToCart);
    els.deliveryForm.addEventListener('submit', saveDeliveryDetails);
    els.closeDelivery.addEventListener('click', closeDeliveryForm);
    els.cancelDelivery.addEventListener('click', closeDeliveryForm);
    els.deliveryModal.addEventListener('click', event => { if (event.target === els.deliveryModal) closeDeliveryForm(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !els.deliveryModal.hidden) closeDeliveryForm(); });

    Object.entries(readyEvents).forEach(([model, eventName]) => {
      window.addEventListener(eventName, () => {
        if (products[active].model3d !== model || !using3D) return;
        active3DRenderer?.render();
        setProductLoading(false);
      });
    });
    window.addEventListener('mizrach-3d-failed', () => {
      const p = products[active];
      if (p.model3d === 'shirt' || p.model3d === 'hoodie') showFallback(p);
    });

    function updateMobileDockVisibility() {
      const mobile = window.matchMedia('(max-width: 700px)').matches;
      const purchaseRect = els.equip.getBoundingClientRect();

      const readingProductDetails = window.scrollY > els.viewer.offsetHeight * 0.72;
      const purchaseOffscreen = purchaseRect.bottom <= 0 || purchaseRect.top >= window.innerHeight - 72;
      const visible = mobile && readingProductDetails && purchaseOffscreen;
      els.mobileDock.classList.toggle('is-visible', visible);
      els.mobileDock.setAttribute('aria-hidden', String(!visible));
    }

    const purchaseObserver = new IntersectionObserver(updateMobileDockVisibility, { threshold: 0.15 });
    purchaseObserver.observe(els.purchase);
    window.addEventListener('scroll', updateMobileDockVisibility, { passive: true });
    window.addEventListener('resize', updateMobileDockVisibility);

    els.viewer.addEventListener('pointerdown', e => {
      stopInertia();
      stopViewSnap();
      setProductViewState();
      const grabbedHandle = using3D &&
        !els.product.className.includes('switching-') &&
        active3DRenderer.beginHandleDrag?.(e.clientX, e.clientY);
      if (grabbedHandle) {
        handleDragging = true;
        dragging = false;
        els.viewer.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
      handleDragging = false;
      dragging = true;
      if (using3D) {
        trackballStart.copy(projectToTrackball(e));
        orientationStart.copy(orientation);
        lastDragOrientation.copy(orientation);
        lastDragTime = performance.now();
      } else {
        dragStart = e.clientX;
        dragStartY = e.clientY;
        rotationStart = rotation;
        pitchStart = pitch;
      }
      els.viewer.setPointerCapture(e.pointerId);
    });
    els.viewer.addEventListener('pointermove', e => {
      if (handleDragging) {
        active3DRenderer.moveHandle?.(e.clientX, e.clientY, performance.now());
        e.preventDefault();
        return;
      }
      if (!dragging) return;
      if (using3D) {
        const current = projectToTrackball(e);
        const delta = new THREE.Quaternion().setFromUnitVectors(trackballStart, current);
        orientation.copy(orientationStart).premultiply(delta).normalize();
        sampleDragVelocity(performance.now());
      } else {
        rotation = rotationStart + (e.clientX - dragStart) * .55;
        pitch = pitchStart + (e.clientY - dragStartY) * .38;
      }
      updateRotation();
    });
    els.viewer.addEventListener('pointerup', () => {
      if (handleDragging) {
        active3DRenderer.endHandleDrag?.();
        handleDragging = false;
        dragging = false;
        return;
      }
      dragging = false;
      startInertia();
    });
    els.viewer.addEventListener('pointercancel', () => {
      if (handleDragging) active3DRenderer.endHandleDrag?.(true);
      handleDragging = false;
      dragging = false;
      stopInertia();
    });

    document.addEventListener('keydown', e => {
      if (e.target.matches('select, button')) return;
      if (e.key.toLowerCase() === 's') { e.preventDefault(); selectProduct(active + 1); }
      if (e.key.toLowerCase() === 'w') { e.preventDefault(); selectProduct(active - 1); }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (using3D) rotateOrientation(new THREE.Vector3(0, 1, 0), -12);
        else { rotation -= 12; updateRotation(); }
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (using3D) rotateOrientation(new THREE.Vector3(0, 1, 0), 12);
        else { rotation += 12; updateRotation(); }
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (using3D) rotateOrientation(new THREE.Vector3(1, 0, 0), -12);
        else { pitch -= 12; updateRotation(); }
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (using3D) rotateOrientation(new THREE.Vector3(1, 0, 0), 12);
        else { pitch += 12; updateRotation(); }
      }
      if (e.key.toLowerCase() === 'e') addToCart();
      if (e.key === 'Escape') toggleCart(false);
    });

    selectProduct(0, true);
