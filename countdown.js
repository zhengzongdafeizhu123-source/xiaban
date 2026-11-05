(function () {
  'use strict';
  var byId = function (id) { return document.getElementById(id); };
  var stage = byId('stage'), countdown = byId('countdown'), image = byId('off-work'), views = byId('views');
  var canvas = byId('hourglass'), timeButton = byId('time-view'), sandButton = byId('sand-view'), moneyButton = byId('money-view');
  var piggy = byId('piggy'), totalDisplay = byId('earnings-total'), tailButton = byId('pig-tail');
  var totalValue = byId('earnings-value'), calendarStatus = byId('calendar-status'), gain = byId('gain'), coin = byId('coin');
  var mode = 'hourglass', period = 'balance';
  var wallet = PigWallet, skinOpen = byId('skin-open'), background = byId('skin-background');
  var art = byId('pig-art'), backgroundArt = byId('skin-background-art');
  var nextCountdown = byId('next-work-countdown'), peekUntil = 0, nextTarget = 0, peekTimer = 0;
  function peekNextWorkday() {
    var now = new Date(wallet.now());
    if (WorkClock.read(now).open) return;
    var target = WorkClock.nextStart(now);
    if (!target) return;
    nextTarget = target;
    peekUntil = performance.now() + 5000;
    if (peekTimer) clearTimeout(peekTimer);
    peekTimer = setTimeout(function () { peekUntil = 0; peekTimer = 0; tick(); }, 5000);
    tick();
  }
  image.setAttribute('role', 'button');
  image.setAttribute('aria-label', '拜拜了您嘞，点击查看距下一工作日早上九点的倒计时');
  image.tabIndex = 0;
  image.addEventListener('click', peekNextWorkday);
  image.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); peekNextWorkday(); }
  });
  try {
    var saved = localStorage.getItem('countdown-view');
    if (['time', 'hourglass', 'money'].indexOf(saved) >= 0) mode = saved;
  } catch (e) {}
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var pigEffects = new PigEffects(byId('pig-effects'), byId('money-atmosphere'), function () { updateIncome(true); });
  piggy.classList.add('fx-ready');
  var currency = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var animation = 0, lastFrame = -Infinity, working = false, elapsed = 0, measuredAt = 0, state;
  var renderer = new PixelHourglass(canvas);
  function render(timestamp) {
    animation = 0;
    if (!working || mode !== 'hourglass' || document.hidden) return;
    if (timestamp - lastFrame >= 1000 / 30) {
      renderer.draw((elapsed + (performance.now() - measuredAt) / 1000) / WorkClock.shift, reducedMotion.matches ? 0 : timestamp);
      lastFrame = timestamp;
    }
    if (!reducedMotion.matches) animation = requestAnimationFrame(render);
  }
  var periods = ['balance','today','month'];
  var labels = { balance:'可用余额', today:'今日累计收入', month:'本月累计收入' };
  function updateIncome(force) {
    if (!state) return;
    var data = wallet.state(), equipped = data?.equipped;
    var skin = SkinCatalog.items[equipped?.pig], backdrop = SkinCatalog.items[equipped?.background];
    if (skin?.id === 'G01' && !data.goldRemaining) skin = null;
    var look = skin?.id === 'G01' ? 'gold' : 'normal';
    var visible = working && mode === 'money';
    var value = wallet.read(period);
    totalDisplay.setAttribute('aria-label', labels[period]);
    periods.forEach(function (name) { byId(name + '-icon').style.display = name === period ? 'inline-block' : 'none'; });
    tailButton.setAttribute('aria-label', '当前显示' + labels[period] + '，拉动猪尾巴切换');
    if (force || !pigEffects.active || !visible) {
      MoneyDigits(totalValue, value == null ? '—' : '¥' + currency.format(value));
    }
    calendarStatus.hidden = Boolean(data?.calendarReady && state.available);
    calendarStatus.textContent = data && !data.calendarReady ? '工作日历待更新' : data ? '' : '正在读取本地存档';
    MoneyDigits(gain, state.available ? '+¥' + state.rate.toFixed(4) : '');
    piggy.dataset.look = look;
    piggy.dataset.coinFrequency = look === 'gold' ? '6' : '1';
    piggy.toggleAttribute('data-skinned', Boolean(skin));
    if (skin?.effect && look !== 'gold') piggy.dataset.effect = skin.effect;
    else delete piggy.dataset.effect;
    document.body.dataset.moneyLook = visible ? look : 'normal';
    var source = skin ? SkinCatalog.artUrl(skin.art) : 'piggy-bank.png';
    if (art.getAttribute('src') !== source) art.setAttribute('src', source);
    background.hidden = !visible || !backdrop;
    if (backdrop?.effect) background.dataset.effect = backdrop.effect;
    else delete background.dataset.effect;
    if (backdrop) {
      var backdropSource = SkinCatalog.artUrl(backdrop.art);
      if (backgroundArt.getAttribute('src') !== backdropSource) backgroundArt.src = backdropSource;
    }
    if (!backdrop) backgroundArt.removeAttribute('src');
    var animate = Boolean(state.earning && wallet.ready() && data?.calendarReady && visible && !document.hidden);
    pigEffects.update(look, animate, visible, state.rate || 0);
    if (animate && !piggy.classList.contains('earning')) {
      var delay = -(Date.now() % 1000) + 'ms';
      coin.style.animationDelay = delay;
      gain.style.animationDelay = delay;
    }
    piggy.classList.toggle('earning', animate);
  }
  function refresh() {
    stage.dataset.mode = mode;
    canvas.hidden = mode !== 'hourglass';
    countdown.hidden = mode === 'money';
    piggy.hidden = mode !== 'money';
    skinOpen.hidden = working && mode !== 'money';
    if (mode === 'money') coin.style.setProperty('--coin-travel', (piggy.clientHeight * 0.14) + 'px');
    timeButton.setAttribute('aria-pressed', String(mode === 'time'));
    sandButton.setAttribute('aria-pressed', String(mode === 'hourglass'));
    moneyButton.setAttribute('aria-pressed', String(mode === 'money'));
    if (animation) cancelAnimationFrame(animation);
    animation = 0;
    lastFrame = -Infinity;
    render(performance.now());
    updateIncome();
  }
  function choose(value) {
    mode = value;
    try { localStorage.setItem('countdown-view', mode); } catch (e) {}
    refresh();
    updateIncome(true);
  }
  timeButton.addEventListener('click', function () { choose('time'); });
  sandButton.addEventListener('click', function () { choose('hourglass'); });
  moneyButton.addEventListener('click', function () { choose('money'); });
  var tugging = false;
  tailButton.addEventListener('click', function () {
    if (tugging) return;
    tugging = true;
    tailButton.classList.add('tugging');
    if (piggy.hasAttribute('data-skinned') && !reducedMotion.matches) {
      piggy.animate([{ transform:'translateX(0)' }, { transform:'translateX(-3px)' }, { transform:'translateX(0)' }], { duration:300 });
    }
    setTimeout(function () {
      period = periods[(periods.indexOf(period) + 1) % periods.length];
      updateIncome(true);
      tailButton.classList.remove('tugging');
      tugging = false;
    }, reducedMotion.matches ? 0 : 300);
  });
  function pad(n) { return String(n).padStart(2, '0'); }
  function tick() {
    var now = new Date(wallet.now());
    state = WorkEarnings.at(now, 10000);
    var clock = state.clock;
    working = clock.open;
    stage.hidden = !working;
    views.hidden = !working;
    var showPeek = !working && performance.now() < peekUntil && nextTarget > now.getTime();
    image.hidden = working || showPeek;
    nextCountdown.hidden = !showPeek;
    if (working) peekUntil = 0;
    if (showPeek) {
      var nextRemaining = Math.ceil((nextTarget - now.getTime()) / 1000);
      nextCountdown.textContent = pad(Math.floor(nextRemaining / 3600)) + ':' + pad(Math.floor(nextRemaining % 3600 / 60)) + ':' + pad(nextRemaining % 60);
    }
    measuredAt = performance.now();
    elapsed = clock.elapsed + now.getMilliseconds() / 1000;
    if (working) {
      var remaining = clock.remaining;
      countdown.textContent = pad(Math.floor(remaining / 3600)) + ':' + pad(Math.floor(remaining % 3600 / 60)) + ':' + pad(remaining % 60);
      canvas.setAttribute('aria-label', '已上班 ' + (100 * elapsed / WorkClock.shift).toFixed(1) + '%，其余为剩余时间');
    }
    refresh();
  }
  function loop() { tick(); setTimeout(loop, 1000 - Date.now() % 1000); }
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('pageshow', tick);
  window.addEventListener('walletchange', function () { tick(); updateIncome(true); });
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', refresh);
  loop();
})();
