(function (root) {
  'use strict';
  function Effects(canvas, rain, onCoin) {
    this.canvas = canvas; this.rain = rain; this.ctx = canvas.getContext('2d'); this.bg = rain.getContext('2d');
    this.onCoin = onCoin; this.look = 'normal'; this.active = false; this.visible = false; this.rate = 0; this.popups = []; this.index = null;
    this.motion = root.matchMedia('(prefers-reduced-motion: reduce)');
    var owner = this;
    this.coin = new Image();
    this.coin.onload = function () {
      var sprite = document.createElement('canvas'); sprite.width = owner.coin.naturalWidth; sprite.height = owner.coin.naturalHeight;
      var paint = sprite.getContext('2d'); paint.drawImage(owner.coin, 0, 0);
      var pixels = paint.getImageData(0, 0, sprite.width, sprite.height);
      for (var i = 0; i < pixels.data.length; i += 4) {
        pixels.data[i+3] = Math.max(pixels.data[i], pixels.data[i+1], pixels.data[i+2]);
        pixels.data[i] = pixels.data[i+1] = pixels.data[i+2] = 255;
      }
      paint.putImageData(pixels, 0, 0); owner.sprite = sprite;
    };
    this.coin.src = 'coin.png';
    this.last = 0; this.frame = this.draw.bind(this); this.raf = requestAnimationFrame(this.frame);
  }
  Effects.prototype.update = function (look, active, visible, rate, started) {
    if (this.look !== look || this.active !== active) { this.index = null; this.popups = []; this.epoch = Number.isFinite(started) ? started : Date.now(); }
    this.look = look; this.active = active; this.visible = visible; this.rate = rate;
  };
  Effects.prototype.glint = function (ctx, x, y, radius, alpha) {
    ctx.globalAlpha = alpha; ctx.fillStyle = '#fff5c5';
    ctx.fillRect(x - radius, y - 1, radius * 2, 2); ctx.fillRect(x - 1, y - radius, 2, radius * 2);
    ctx.fillRect(x - 2, y - 2, 4, 4); ctx.globalAlpha = 1;
  };
  Effects.prototype.draw = function (time) {
    this.raf = requestAnimationFrame(this.frame);
    if (time - this.last < 1000 / 30) return;
    this.last = time;
    var canvas = this.canvas, box = canvas.parentElement.getBoundingClientRect(), ctx = this.ctx;
    var ratio = Math.min(root.devicePixelRatio || 1, 2), w = box.width, h = box.height;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) { canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, w, h);
    var bw = root.innerWidth, bh = root.innerHeight;
    if (this.rain.width !== Math.round(bw * ratio) || this.rain.height !== Math.round(bh * ratio)) { this.rain.width = Math.round(bw * ratio); this.rain.height = Math.round(bh * ratio); }
    var bg = this.bg; bg.setTransform(ratio, 0, 0, ratio, 0, 0); bg.clearRect(0, 0, bw, bh);
    if (!this.visible || document.hidden) return;
    var gold = this.look === 'gold', rage = ['red', 'violet', 'cyan'].includes(this.look), rest = this.look === 'exhausted';
    var color = gold ? '#ffd45d' : this.look === 'red' ? '#ff662f' : this.look === 'violet' ? '#cc72ff' : this.look === 'cyan' ? '#68e8ff' : '#eee';
    var motionTime = this.motion.matches ? 0 : time;
    if (gold) {
      var drops = bw < 600 ? 24 : 64;
      for (var k = 0; k < drops; k++) {
        var seed = ((k * 37 + 11) % 101) / 101, x = ((k * 71 + 19) % 103) / 103 * bw;
        var y = (motionTime / 1000 * (45 + seed * 90) + k * 123) % (bh + 160) - 80;
        var center = Math.abs(x - bw / 2) < w * .38;
        bg.globalAlpha = center ? .12 : .5 + seed * .45; bg.fillStyle = '#ffd45b';
        for (var q = 0; q < 8; q++) bg.fillRect(x, y - q * 9, 2 + seed * 2, 4);
        if (this.sprite && k % 3 === 0) { bg.globalCompositeOperation = 'screen'; bg.filter = 'sepia(1) saturate(5)'; bg.drawImage(this.sprite, x - 8, y - 8, 17, 17); bg.filter = 'none'; bg.globalCompositeOperation = 'source-over'; }
        if (k % 5 === 0) this.glint(bg, x, y, 4 + seed * 3, center ? .12 : .8);
      }
      bg.globalAlpha = 1;
      var spots = [[.70,.2],[.15,.43],[.83,.56],[.3,.78],[.65,.77],[.5,.23],[.25,.28]];
      spots.forEach(function (p, i) { this.glint(ctx, w*p[0], h*p[1], 5 + 4*Math.max(0,Math.sin(motionTime/230+i)), .5+.5*Math.sin(motionTime/290+i)); }, this);
    }
    if (rest || !this.active) return;
    var frequency = gold ? 6 : rage ? 2 : 1, interval = 1000 / frequency, now = Date.now(), index = Math.floor((now - this.epoch) / interval);
    var reward = this.rate * (gold ? 1 / 6 : rage ? 10 : 1);
    if (this.index !== null && index !== this.index) {
      var count = Math.min(6, Math.max(1, index - this.index));
      for (var event = 0; event < count; event++) this.popups.push({ time: time, text: '+¥' + reward.toFixed(4), lane: gold ? (index + event) % 2 : 0 });
      this.onCoin();
    }
    this.index = index;
    var lanes = gold ? 2 : 1, period = gold ? 1000/3 : rage ? 500 : 1000, size = Math.max(18, w * .065);
    for (var lane = 0; lane < lanes; lane++) {
      var phase = this.motion.matches ? .4 : ((now - this.epoch + lane * interval) % period) / period;
      var xCoin = w * (gold ? (lane ? .555 : .455) : .506), yCoin = h * (-.025 + phase * .22);
      if (this.sprite) {
        ctx.globalCompositeOperation = 'screen'; ctx.filter = gold ? 'sepia(1) saturate(5) brightness(1.25)' : rage ? 'sepia(1) saturate(5) hue-rotate('+(this.look==='red'?-40:this.look==='violet'?240:120)+'deg)' : 'none';
        ctx.shadowColor = color; ctx.shadowBlur = gold ? 12 : rage ? 6 : 0;
        ctx.imageSmoothingEnabled = false; ctx.drawImage(this.sprite, xCoin-size/2, yCoin, size, size); ctx.filter='none'; ctx.shadowBlur=0; ctx.globalCompositeOperation='source-over';
      }
      if (gold) { this.glint(ctx, xCoin+size*.3, yCoin+size*.2, size*.35, .9); this.glint(ctx, xCoin-size*.4, yCoin+size*.8, size*.2, .8); }
    }
    this.popups = this.popups.filter(function (p) { return time - p.time < 1000; });
    this.popups.forEach(function (p) {
      var age=(time-p.time)/1000, x=w*(gold ? (p.lane ? .64 : .12) : .65);
      var y=h*((gold ? .20 : rage ? .16 : .13)-(this.motion.matches ? 0 : age*(gold ? .22 : rage ? .18 : .10)));
      ctx.globalAlpha = 1-age; ctx.fillStyle = color;
      ctx.font = '400 '+Math.max(12,Math.min(24,w*.034))+'px Consolas, monospace';
      var chars = p.text.split(''), offset=0;
      chars.forEach(function (char) { ctx.fillStyle=gold||char==='6'||char==='8'?'#e9ba55':color; ctx.shadowColor='#edb443';ctx.shadowBlur=char==='8'?7:0;ctx.fillText(char,x+offset,y);offset+=ctx.measureText(char).width; });
      ctx.shadowBlur=0;ctx.globalAlpha=1;
    }, this);
  };
  root.PigEffects = Effects;
})(window);
