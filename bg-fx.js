/* TradingFlow ambient background: aurora mesh + perspective grid + ticker particles.
   Self-contained — injects its own DOM/CSS. Include with <script src="bg-fx.js"></script>. */
(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── CSS ─────────────────────────────────────────────── */
  var css = [
    '#bgfx{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none}',
    'body>*:not(#bgfx){position:relative;z-index:1}',

    /* aurora blobs */
    '.bgfx-blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:0.55;will-change:transform}',
    '.bgfx-b1{width:55vw;height:55vw;left:-15vw;top:-20vw;background:radial-gradient(circle,rgba(59,130,246,0.30),transparent 65%)}',
    '.bgfx-b2{width:45vw;height:45vw;right:-12vw;top:10vh;background:radial-gradient(circle,rgba(6,182,212,0.22),transparent 65%)}',
    '.bgfx-b3{width:50vw;height:50vw;left:20vw;bottom:-25vw;background:radial-gradient(circle,rgba(129,140,248,0.20),transparent 65%)}',
    '.bgfx-b4{width:35vw;height:35vw;right:15vw;bottom:5vh;background:radial-gradient(circle,rgba(192,132,252,0.14),transparent 65%)}',
    '@keyframes bgfx-drift1{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(6vw,4vh) scale(1.12)}66%{transform:translate(-3vw,8vh) scale(0.94)}}',
    '@keyframes bgfx-drift2{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(-7vw,6vh) scale(1.08)}75%{transform:translate(4vw,-4vh) scale(0.9)}}',
    '@keyframes bgfx-drift3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(8vw,-6vh) scale(1.15)}}',
    '.bgfx-b1{animation:bgfx-drift1 26s ease-in-out infinite}',
    '.bgfx-b2{animation:bgfx-drift2 32s ease-in-out infinite}',
    '.bgfx-b3{animation:bgfx-drift3 38s ease-in-out infinite}',
    '.bgfx-b4{animation:bgfx-drift1 44s ease-in-out infinite reverse}',

    /* noise texture */
    '.bgfx-noise{position:absolute;inset:0;opacity:0.05;background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27140%27 height=%27140%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.85%27 numOctaves=%272%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")}',

    /* perspective grid horizon */
    '.bgfx-grid-wrap{position:absolute;left:0;right:0;bottom:0;height:42vh;perspective:420px;perspective-origin:50% 0%;-webkit-mask-image:linear-gradient(to top,rgba(0,0,0,0.9),transparent 90%);mask-image:linear-gradient(to top,rgba(0,0,0,0.9),transparent 90%)}',
    '.bgfx-grid{position:absolute;left:-50%;width:200%;height:300%;top:0;transform:rotateX(62deg);transform-origin:50% 0%;',
    'background-image:linear-gradient(rgba(59,130,246,0.16) 1px,transparent 1px),linear-gradient(90deg,rgba(6,182,212,0.13) 1px,transparent 1px);',
    'background-size:44px 44px;animation:bgfx-gridmove 3.2s linear infinite}',
    '@keyframes bgfx-gridmove{from{background-position:0 0}to{background-position:0 44px}}',
    '.bgfx-horizon{position:absolute;left:0;right:0;bottom:calc(42vh - 2px);height:2px;background:linear-gradient(90deg,transparent,rgba(59,130,246,0.35) 30%,rgba(6,182,212,0.45) 50%,rgba(59,130,246,0.35) 70%,transparent);filter:blur(1px)}',

    /* particles canvas */
    '#bgfx-canvas{position:absolute;inset:0;width:100%;height:100%}',

    /* vignette on top of everything in the bg layer */
    '.bgfx-vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(3,7,18,0.55) 100%)}',

    /* reduced motion: freeze */
    '@media (prefers-reduced-motion:reduce){.bgfx-blob,.bgfx-grid{animation:none!important}}'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ── DOM ─────────────────────────────────────────────── */
  var root = document.createElement('div');
  root.id = 'bgfx';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML =
    '<div class="bgfx-blob bgfx-b1"></div>' +
    '<div class="bgfx-blob bgfx-b2"></div>' +
    '<div class="bgfx-blob bgfx-b3"></div>' +
    '<div class="bgfx-blob bgfx-b4"></div>' +
    '<div class="bgfx-noise"></div>' +
    '<div class="bgfx-horizon"></div>' +
    '<div class="bgfx-grid-wrap"><div class="bgfx-grid"></div></div>' +
    '<canvas id="bgfx-canvas"></canvas>' +
    '<div class="bgfx-vig"></div>';
  document.body.insertBefore(root, document.body.firstChild);

  /* ── TICKER PARTICLES ────────────────────────────────── */
  if (reduced) return;

  var canvas = document.getElementById('bgfx-canvas');
  var ctx = canvas.getContext('2d');
  var W, H, DPR = Math.min(2, window.devicePixelRatio || 1);

  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  var TICKERS = ['NVDA','AAPL','TSLA','MSFT','META','AMD','BTC','ETH','SPX','PLTR','COIN','AMZN','GOOGL','NFLX','+2.4%','-1.2%','+0.8%','+5.1%','▲','▼'];
  var COUNT = Math.min(46, Math.floor(W * H / 32000));
  var LINK_DIST = 130;

  function mkParticle() {
    var up = Math.random() > 0.42;
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.18 - 0.04,
      txt: TICKERS[Math.floor(Math.random() * TICKERS.length)],
      size: 8 + Math.random() * 4,
      up: up,
      alpha: 0,
      life: 0,
      maxLife: 900 + Math.random() * 900
    };
  }

  var parts = [];
  for (var i = 0; i < COUNT; i++) {
    var p = mkParticle();
    p.life = Math.random() * p.maxLife; // stagger
    parts.push(p);
  }

  var visible = true;
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; });

  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    ctx.clearRect(0, 0, W, H);

    /* constellation lines */
    ctx.lineWidth = 1;
    for (var a = 0; a < parts.length; a++) {
      for (var b = a + 1; b < parts.length; b++) {
        var dx = parts[a].x - parts[b].x, dy = parts[a].y - parts[b].y;
        var d2 = dx * dx + dy * dy;
        if (d2 < LINK_DIST * LINK_DIST) {
          var t = 1 - Math.sqrt(d2) / LINK_DIST;
          ctx.strokeStyle = 'rgba(59,130,246,' + (t * 0.10 * Math.min(parts[a].alpha, parts[b].alpha)).toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(parts[a].x, parts[a].y);
          ctx.lineTo(parts[b].x, parts[b].y);
          ctx.stroke();
        }
      }
    }

    /* ticker text */
    for (var j = 0; j < parts.length; j++) {
      var q = parts[j];
      q.x += q.vx; q.y += q.vy; q.life++;

      /* fade in / out over life */
      var ratio = q.life / q.maxLife;
      q.alpha = ratio < 0.1 ? ratio / 0.1 : ratio > 0.85 ? (1 - ratio) / 0.15 : 1;

      if (q.life > q.maxLife || q.x < -60 || q.x > W + 60 || q.y < -30 || q.y > H + 30) {
        parts[j] = mkParticle();
        continue;
      }

      ctx.font = '500 ' + q.size + 'px "Fira Code", monospace';
      ctx.fillStyle = q.up
        ? 'rgba(52,211,153,' + (q.alpha * 0.34).toFixed(3) + ')'
        : 'rgba(96,165,250,' + (q.alpha * 0.30).toFixed(3) + ')';
      ctx.fillText(q.txt, q.x, q.y);
    }
  }
  tick();
})();
