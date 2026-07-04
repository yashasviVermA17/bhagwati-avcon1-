(function () {
  'use strict';

  var cvs = document.getElementById('tech-bg-canvas');
  if (!cvs) return;
  if (typeof THREE === 'undefined') {
    cvs.style.display = 'none';
    return;
  }
  cvs.style.display = 'block';
  cvs.style.width = '100%';
  cvs.style.height = '100%';

  var isMobile = window.innerWidth < 768;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var animEnabled = !reducedMotion;
  var PHASES = 4;
  var phaseW = new Float32Array(PHASES);
  var progress = 0;
  var lastT = 0;
  var flowAngle = 0;
  var scene, cam, renderer, geom, mat, mesh;
  var pipeCol, flowCol;
  var cardEl;
  var resizeTimer;
  var contextLost = false;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, t) { var x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }

  var R_OUTER = 1.6, R_INNER = 0.95, HALF_LEN = 1.3;
  var CORR_FREQ = 4, CORR_AMP = 0.55;
  var scale = isMobile ? 0.7 : 1;
  var RINGS = Math.round(12 * scale), RING_PTS = Math.round(80 * scale);
  var LINES = Math.round(16 * scale), LINE_PTS = Math.round(40 * scale);
  var OUTER_COUNT = RINGS * RING_PTS + LINES * LINE_PTS;
  var INNER_COUNT = Math.round(800 * scale);
  var COUNT = OUTER_COUNT + INNER_COUNT;

  function pipeR(z) {
    return R_OUTER + CORR_AMP * Math.sin(CORR_FREQ * Math.PI * 2 * (z + HALF_LEN) / (HALF_LEN * 2));
  }

  function genGrid(smooth) {
    var arr = new Float32Array(OUTER_COUNT * 3);
    var idx = 0;
    for (var r = 0; r < RINGS; r++) {
      var z = -HALF_LEN + (r / (RINGS - 1)) * HALF_LEN * 2;
      var radius = smooth ? R_OUTER : pipeR(z);
      for (var j = 0; j < RING_PTS; j++) {
        var ang = (j / RING_PTS) * Math.PI * 2;
        arr[idx++] = Math.cos(ang) * radius;
        arr[idx++] = Math.sin(ang) * radius;
        arr[idx++] = z;
      }
    }
    for (var l = 0; l < LINES; l++) {
      var ang = (l / LINES) * Math.PI * 2;
      for (var j = 0; j < LINE_PTS; j++) {
        var z = -HALF_LEN + (j / (LINE_PTS - 1)) * HALF_LEN * 2;
        var radius = smooth ? R_OUTER : pipeR(z);
        arr[idx++] = Math.cos(ang) * radius;
        arr[idx++] = Math.sin(ang) * radius;
        arr[idx++] = z;
      }
    }
    return arr;
  }

  function genInner() {
    var arr = new Float32Array(INNER_COUNT * 3);
    for (var i = 0; i < INNER_COUNT; i++) {
      var ang = rand(0, Math.PI * 2), z = rand(-HALF_LEN, HALF_LEN);
      arr[i * 3] = Math.cos(ang) * R_INNER;
      arr[i * 3 + 1] = Math.sin(ang) * R_INNER;
      arr[i * 3 + 2] = z;
    }
    return arr;
  }

  function genHelix(count, radius, turns, length) {
    var arr = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      var t = i / count;
      var a = t * turns * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * radius;
      arr[i * 3 + 1] = Math.sin(a) * radius;
      arr[i * 3 + 2] = (t - 0.5) * length;
    }
    return arr;
  }

  var targets = [];
  var inner = genInner();

  targets.push((function () {
    var arr = new Float32Array(COUNT * 3);
    for (var i = 0; i < COUNT; i++) {
      var theta = rand(0, Math.PI * 2), phi = Math.acos(rand(-1, 1)), r = rand(0.5, 3.5);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.cos(phi);
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  })());

  function buildPhase(outerArr) {
    var arr = new Float32Array(COUNT * 3);
    for (var i = 0; i < OUTER_COUNT; i++) {
      arr[i * 3] = outerArr[i * 3]; arr[i * 3 + 1] = outerArr[i * 3 + 1]; arr[i * 3 + 2] = outerArr[i * 3 + 2];
    }
    for (var i = 0; i < INNER_COUNT; i++) {
      arr[(OUTER_COUNT + i) * 3] = inner[i * 3];
      arr[(OUTER_COUNT + i) * 3 + 1] = inner[i * 3 + 1];
      arr[(OUTER_COUNT + i) * 3 + 2] = inner[i * 3 + 2];
    }
    return arr;
  }

  targets.push(buildPhase(genGrid(true)));
  targets.push(buildPhase(genGrid(false)));

  (function () {
    var outer = genGrid(false);
    var flow = genHelix(INNER_COUNT, 1.3, 8, 4.5);
    var arr = new Float32Array(COUNT * 3);
    for (var i = 0; i < OUTER_COUNT; i++) {
      arr[i * 3] = outer[i * 3]; arr[i * 3 + 1] = outer[i * 3 + 1]; arr[i * 3 + 2] = outer[i * 3 + 2];
    }
    for (var i = 0; i < INNER_COUNT; i++) {
      arr[(OUTER_COUNT + i) * 3] = flow[i * 3];
      arr[(OUTER_COUNT + i) * 3 + 1] = flow[i * 3 + 1];
      arr[(OUTER_COUNT + i) * 3 + 2] = flow[i * 3 + 2];
    }
    targets.push(arr);
  })();

  function calcWeights(p) {
    for (var i = 0; i < PHASES; i++) phaseW[i] = 0;
    if (p <= 0) { phaseW[0] = 1; return; }
    if (p >= 1) { phaseW[PHASES - 1] = 1; return; }
    var total = PHASES - 1, exact = p * total, idx = Math.floor(exact), frac = exact - idx;
    phaseW[idx] = 1 - frac;
    if (idx + 1 < PHASES) phaseW[idx + 1] = frac;
  }

  function resize() {
    if (contextLost || !renderer) return;
    var parent = cvs.parentElement;
    var w = parent.clientWidth, h = parent.clientHeight;
    if (w === 0 || h === 0) {
      cvs.style.display = 'block';
      cvs.width = window.innerWidth;
      cvs.height = window.innerHeight;
      w = window.innerWidth;
      h = window.innerHeight;
    }
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }

  function debouncedResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var wasMobile = isMobile;
      isMobile = window.innerWidth < 768;
      if (wasMobile !== isMobile) {
        location.reload();
        return;
      }
      resize();
    }, 200);
  }

  function readScroll() {
    var sy = window.lenis ? Math.round(window.lenis.scroll) : window.scrollY;
    var sec = document.getElementById('technology');
    if (!sec) return;
    var secTop = sec.offsetTop, secH = sec.offsetHeight, winH = window.innerHeight;
    return clamp((sy + winH - secTop) / (secH + winH - 100), 0, 1);
  }

  function init() {
    if (!animEnabled) {
      cvs.style.display = 'none';
      var pbar = document.getElementById('tech-progress');
      if (pbar) pbar.style.display = 'none';
      return;
    }

    scene = new THREE.Scene();

    cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    cam.position.set(isMobile ? -3.2 : -4, isMobile ? 1.4 : 1.8, isMobile ? 3 : 3.5);
    cam.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ canvas: cvs, alpha: false, antialias: !isMobile });
    renderer.setClearColor(0x000000, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));

    cvs.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      contextLost = true;
    });
    cvs.addEventListener('webglcontextrestored', function () {
      contextLost = false;
      init();
    });

    pipeCol = new Float32Array(COUNT * 3);
    flowCol = new Float32Array(COUNT * 3);
    var sizes = new Float32Array(COUNT);
    var c1 = new THREE.Color('#2c7a7b'), c2 = new THREE.Color('#4fd1c5');
    var c3 = new THREE.Color('#00b4d8'), c4 = new THREE.Color('#e0f7fa');
    for (var i = 0; i < COUNT; i++) {
      var t = Math.random();
      var c = c1.clone().lerp(c2, t);
      pipeCol[i * 3] = c.r; pipeCol[i * 3 + 1] = c.g; pipeCol[i * 3 + 2] = c.b;
      c = c3.clone().lerp(c4, t * 0.7);
      flowCol[i * 3] = c.r; flowCol[i * 3 + 1] = c.g; flowCol[i * 3 + 2] = c.b;
      sizes[i] = rand(isMobile ? 0.04 : 0.035, isMobile ? 0.07 : 0.065);
    }

    geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(targets[0]), 3));
    geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pipeCol), 3));
    geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    mat = new THREE.PointsMaterial({
      size: isMobile ? 0.08 : 0.06, vertexColors: true, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });

    mesh = new THREE.Points(geom, mat);
    scene.add(mesh);

    cardEl = document.querySelector('#technology .tech-part1');

    resize();
    window.addEventListener('resize', debouncedResize);
    animate();
  }

  function animate(time) {
    requestAnimationFrame(animate);

    if (!animEnabled || contextLost || !mesh) return;

    var dt = lastT ? (time - lastT) / 1000 : 0.016;
    lastT = time;

    var raw = readScroll();
    if (raw !== undefined) progress += (raw - progress) * Math.min(1, dt * 4);

    var pbar = document.getElementById('tech-progress');
    if (pbar) pbar.style.transform = 'scaleX(' + progress + ')';

    calcWeights(progress);
    flowAngle += dt * 0.5 * phaseW[3];

    var pos = geom.attributes.position.array;
    var col = geom.attributes.color.array;

    for (var i = 0; i < COUNT; i++) {
      var i3 = i * 3, x = 0, y = 0, z = 0;
      for (var p = 0; p < PHASES; p++) {
        var w = phaseW[p];
        if (w > 0) { x += targets[p][i3] * w; y += targets[p][i3 + 1] * w; z += targets[p][i3 + 2] * w; }
      }

      if (phaseW[3] > 0.01 && i >= OUTER_COUNT) {
        var a = flowAngle + (i - OUTER_COUNT) * 0.005;
        var ca = Math.cos(a), sa = Math.sin(a), bx = x, by = y;
        x = bx * ca - by * sa;
        y = bx * sa + by * ca;
        z += Math.sin(flowAngle + i * 0.02) * 0.3 * phaseW[3];
      }

      pos[i3] = x; pos[i3 + 1] = y; pos[i3 + 2] = z;

      if (i >= OUTER_COUNT) {
        var b = phaseW[3];
        col[i3] = pipeCol[i3] * (1 - b) + flowCol[i3] * b;
        col[i3 + 1] = pipeCol[i3 + 1] * (1 - b) + flowCol[i3 + 1] * b;
        col[i3 + 2] = pipeCol[i3 + 2] * (1 - b) + flowCol[i3 + 2] * b;
      }
    }

    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;

    mesh.rotation.y += dt * 0.05;
    mesh.position.y = Math.sin(time * 0.0003) * 0.03;

    if (cardEl) {
      var rect = cardEl.getBoundingClientRect();
      var vh = window.innerHeight;
      var cardProgress = clamp(1 - (rect.top + rect.height * 0.3) / vh, 0, 1);
      var shift = smoothstep(0, 0.7, cardProgress) * (isMobile ? 2.5 : 3.5);
      mesh.position.x = lerp(mesh.position.x, shift, Math.min(1, dt * 3));
    }

    renderer.render(scene, cam);
  }

  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function (e) {
    if (e.matches) {
      animEnabled = false;
      if (cvs) cvs.style.display = 'none';
      var pbar = document.getElementById('tech-progress');
      if (pbar) pbar.style.display = 'none';
    } else {
      animEnabled = true;
      if (cvs) cvs.style.display = 'block';
      var pbar = document.getElementById('tech-progress');
      if (pbar) pbar.style.display = '';
      if (!mesh) init();
    }
  });

  if (typeof THREE !== 'undefined') { init(); }
  else {
    var check = setInterval(function () {
      if (typeof THREE !== 'undefined') { clearInterval(check); init(); }
    }, 100);
  }
})();
