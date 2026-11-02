/* The canvas is a live visualization: each settled grain represents an equal share of the workday. */
(function (root) {
  'use strict';
  var STEP = 7;
  var CENTER = 200;
  function width(y) {
    var t = y <= 298 ? (y - 11) / 287 : (585 - y) / 287;
    t = Math.max(0, Math.min(1, t));
    var k = Math.max(0, Math.min(1, (t - 0.12) / 0.88));
    return 10 + 180 * (1 - k * k * (3 - 2 * k));
  }
  var upper = [], lower = [], outline = [];
  for (var y = 11; y <= 585; y += STEP) {
    var edge = Math.round(width(y) / STEP) * STEP;
    outline.push([CENTER - edge, y], [CENTER + edge, y]);
    for (var x = CENTER - edge + STEP * 2; x <= CENTER + edge - STEP * 2; x += STEP) {
      if (y < 291 && y > 18) upper.push([x, y]);
      if (y > 305 && y < 578) lower.push([x, y]);
    }
  }
  for (var x = 11; x <= 389; x += STEP) outline.push([x, 11], [x, 585]);
  upper.sort(function (a, b) { return (b[1] + Math.abs(b[0] - CENTER) * 0.08) - (a[1] + Math.abs(a[0] - CENTER) * 0.08); });
  lower.sort(function (a, b) { return (b[1] - Math.abs(b[0] - CENTER) * 0.48) - (a[1] - Math.abs(a[0] - CENTER) * 0.48); });
  var total = Math.floor(Math.min(upper.length, lower.length) * 0.88);
  function quantities(progress) {
    var below = Math.round(total * Math.max(0, Math.min(1, progress)));
    return { upper: total - below, lower: below, total: total };
  }
  function PixelHourglass(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    var ratio = Math.min(root.devicePixelRatio || 1, 2);
    canvas.width = 400 * ratio;
    canvas.height = 600 * ratio;
    this.context.scale(ratio, ratio);
  }
  PixelHourglass.prototype.draw = function (progress, time) {
    var ctx = this.context;
    var counts = quantities(progress);
    ctx.clearRect(0, 0, 400, 600);
    ctx.fillStyle = '#eee';
    outline.forEach(function (p) { ctx.fillRect(p[0] - 2.25, p[1] - 2.25, 4.5, 4.5); });
    function grains(points, count) {
      for (var i = 0; i < count; i++) {
        var p = points[i];
        var noise = ((p[0] * 17 + p[1] * 31) % 19) / 19;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.65 + noise * 0.35) + ')';
        ctx.fillRect(p[0] - 2 + (noise - 0.5) * 1.4, p[1] - 2 + (noise - 0.5) * 1.4, 4, 4);
      }
    }
    grains(upper, counts.upper);
    grains(lower, counts.lower);
    if (progress > 0 && progress < 1) {
      var surface = 578;
      for (var i = 0; i < counts.lower; i++) {
        if (Math.abs(lower[i][0] - CENTER) < 14) surface = Math.min(surface, lower[i][1]);
      }
      var distance = Math.max(7, surface - 299);
      ctx.fillStyle = '#eee';
      // A handful of moving grains shows flow; settled grain counts encode the exact time ratio.
      for (var j = 0; j < 7; j++) {
        var fraction = (time / 1500 + j / 7) % 1;
        var streamY = 299 + fraction * fraction * distance;
        var streamX = CENTER + Math.sin(j * 9.3 + fraction * 3) * 2;
        ctx.fillRect(streamX - 1.5, streamY, 3, 3);
      }
    }
  };
  PixelHourglass.quantities = quantities;
  root.PixelHourglass = PixelHourglass;
})(typeof window === 'undefined' ? globalThis : window);
