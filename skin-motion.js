(function () {
  'use strict';
  var motion = matchMedia('(prefers-reduced-motion: reduce)');
  var tracks = {
    c01:[[.24,.36],[.31,.29],[.68,.28],[.76,.34],[.38,.72],[.55,.76],[.68,.73]],
    c03:[[.22,.36],[.35,.28],[.51,.27],[.66,.29],[.77,.34]],
    r01:[[.26,.32],[.34,.27],[.48,.27],[.63,.27],[.72,.33]],
    r02:[[.26,.60],[.31,.67],[.40,.73],[.63,.73],[.72,.65]],
    r03:[[.30,.28],[.40,.23],[.54,.23],[.63,.26],[.73,.30],[.81,.40],[.85,.55]],
    r05:[[.24,.31],[.35,.22],[.68,.23],[.74,.32],[.34,.76],[.68,.76]],
    g01:[[.19,.40],[.30,.27],[.68,.25],[.78,.32],[.34,.74],[.67,.74]]
  };
  var palettes = {
    c01:['#fef6ff','#affce9','#ffd9c9'], c03:['#ff7998','#ffe26f','#70ffc7','#8a9bff'],
    r01:['#ffc38e','#ff5e41'], r02:['#d1efff','#87c4ff'], r03:['#ffd780','#ffa232'],
    r05:['#a1ff86','#bdfbd5'], g01:['#fff2aa','#ffdd68']
  };
  var active = new Set(), last = -Infinity;
  function points(ctx, id, w, h, t, scale) {
    var list = tracks[id], colors = palettes[id];
    list.forEach(function (point, i) {
      var phase = (t * .55 + i / list.length) % 1;
      var alpha = Math.max(0, 1 - Math.abs(phase - .5) * 4);
      if (!alpha) return;
      var x = point[0] * w, y = point[1] * h - (id === 'r05' ? phase * .09 * h : 0);
      ctx.globalAlpha = alpha * .85;
      ctx.fillStyle = colors[(Math.floor(t) + i) % colors.length];
      ctx.fillRect(x - scale * 2, y, scale * 5, scale);
      ctx.fillRect(x, y - scale * 2, scale, scale * 5);
    });
  }
  function draw(ctx, id, w, h, t) {
    var unit = Math.max(1, Math.round(w / 280));
    if (tracks[id]) points(ctx, id, w, h, t, unit);
    if (id === 'c02') {
      var colors = ['#ff6889','#ffe468','#7efedc','#929dff'];
      for (var i = 0; i < 20; i++) {
        var phase = (i / 20 + t * .27) % 1;
        ctx.fillStyle = colors[(i + Math.floor(t / 2)) % colors.length];
        ctx.globalAlpha = .16 + .19 * Math.sin(phase * Math.PI);
        var y = .28 + (1 - Math.abs(phase - .5) * 2) * .07;
        ctx.fillRect(w * (.24 + phase * .54), h * y, unit * 2, h * .028);
        ctx.fillRect(w * (.26 + phase * .49), h * (1 - y), unit * 2, h * .022);
      }
    }
    if (id === 'r04') {
      ctx.strokeStyle = '#99edff';
      for (var j = 0; j < 4; j++) {
        var age = (t * .43 + j * .27) % 1;
        ctx.globalAlpha = .55 * (1 - age);
        ctx.strokeRect(w * (.88 + Math.sin(age * 8) * .015), h * (.51 - age * .33), unit * (2 + j), unit * (2 + j));
      }
    }
    if (id === 'r06' || id === 'c04') {
      for (var k = 0; k < 25; k++) {
        var side = k % 2 ? .79 : .02;
        var x = w * (side + ((k * 11) % 19) / 100);
        var progress = (t * (id === 'r06' ? .64 : .2) + k * .173) % 1;
        var y = h * progress;
        ctx.fillStyle = id === 'r06' ? '#8cb7da' : ['#9be4ed','#cabbff','#ffdbab'][k % 3];
        ctx.globalAlpha = id === 'r06' ? .22 : Math.sin(progress * Math.PI) * .54;
        ctx.fillRect(x, y, unit, unit * (id === 'r06' ? 5 : 2));
      }
      if (id === 'r06') {
        ctx.fillStyle = '#ffa659';
        ctx.globalAlpha = .55;
        var position = 1 - (t * .12 % 1);
        ctx.fillRect(w * position, h * .79, unit * 3, unit);
        ctx.fillRect(w * (position - .03), h * .81, unit * 2, unit);
      }
    }
    ctx.globalAlpha = 1;
  }
  function frame(time) {
    requestAnimationFrame(frame);
    if (time - last < 42 || document.hidden) return;
    last = time;
    var targets = motion.matches ? [] : Array.from(document.querySelectorAll(
      '#piggy:not([hidden])[data-effect], #skin-background:not([hidden])[data-effect], #skin-window[open] .skin-detail-art[data-effect], ' +
      '#skin-window[open] .skin-card:hover .skin-art[data-effect], #skin-window[open] .skin-card:focus-visible .skin-art[data-effect]'));
    active.forEach(function (target) {
      if (!targets.includes(target)) {
        target.querySelector('.skin-motion-layer')?.remove();
        active.delete(target);
      }
    });
    targets.forEach(function (target) {
      if (!target.dataset.effect || !target.clientWidth || !target.clientHeight) return;
      var layer = target.querySelector('.skin-motion-layer');
      if (!layer) {
        layer = document.createElement('canvas');
        layer.className = 'skin-motion-layer';
        layer.setAttribute('aria-hidden', 'true');
        target.append(layer);
      }
      active.add(target);
      var w = target.clientWidth, h = target.clientHeight;
      if (layer.width !== w || layer.height !== h) { layer.width = w; layer.height = h; }
      var ctx = layer.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      draw(ctx, target.dataset.effect, w, h, time / 1000);
    });
  }
  requestAnimationFrame(frame);
})();
