(function () {
  'use strict';
  var stage = document.getElementById('stage');
  var countdown = document.getElementById('countdown');
  var image = document.getElementById('off-work');
  var views = document.getElementById('views');
  var canvas = document.getElementById('hourglass');
  var timeButton = document.getElementById('time-view');
  var sandButton = document.getElementById('sand-view');
  var mode = 'hourglass';
  try { if (localStorage.getItem('countdown-view') === 'time') mode = 'time'; } catch (e) {}
  var formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var animation = 0;
  var lastFrame = -Infinity;
  var working = false;
  var elapsed = 0;
  var measuredAt = 0;
  var renderer = new PixelHourglass(canvas);

  function render(timestamp) {
    animation = 0;
    if (!working || mode !== 'hourglass' || document.hidden) return;
    if (timestamp - lastFrame >= 1000 / 30) {
      var progress = (elapsed + (Date.now() - measuredAt) / 1000) / 32400;
      renderer.draw(progress, reducedMotion.matches ? 0 : timestamp);
      lastFrame = timestamp;
    }
    if (!reducedMotion.matches) animation = requestAnimationFrame(render);
  }
  function refresh() {
    stage.dataset.mode = mode;
    canvas.hidden = mode !== 'hourglass';
    timeButton.setAttribute('aria-pressed', String(mode === 'time'));
    sandButton.setAttribute('aria-pressed', String(mode === 'hourglass'));
    if (animation) cancelAnimationFrame(animation);
    animation = 0;
    lastFrame = -Infinity;
    render(performance.now());
  }
  function choose(value) {
    mode = value;
    try { localStorage.setItem('countdown-view', mode); } catch (e) {}
    refresh();
  }
  timeButton.addEventListener('click', function () { choose('time'); });
  sandButton.addEventListener('click', function () { choose('hourglass'); });
  function pad(n) { return String(n).padStart(2, '0'); }
  function tick() {
    var parts = {};
    var now = new Date();
    formatter.formatToParts(now).forEach(function (p) { parts[p.type] = p.value; });
    var seconds = (Number(parts.hour) % 24) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
    working = seconds >= 32400 && seconds < 64800;
    stage.hidden = !working;
    views.hidden = !working;
    image.hidden = working;
    measuredAt = now.getTime();
    elapsed = seconds - 32400 + now.getMilliseconds() / 1000;
    if (working) {
      var remaining = 64800 - seconds;
      countdown.textContent = pad(Math.floor(remaining / 3600)) + ':' + pad(Math.floor(remaining % 3600 / 60)) + ':' + pad(remaining % 60);
      canvas.setAttribute('aria-label', '已上班 ' + (100 * elapsed / 32400).toFixed(1) + '%，其余为剩余时间');
    }
    refresh();
  }
  function loop() { tick(); setTimeout(loop, 1000 - Date.now() % 1000); }
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('pageshow', tick);
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', refresh);
  loop();
})();
