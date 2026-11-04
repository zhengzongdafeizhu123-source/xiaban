(function () {
  'use strict';
  var byId = function (id) { return document.getElementById(id); };
  var stage = byId('stage'), countdown = byId('countdown'), image = byId('off-work'), views = byId('views');
  var canvas = byId('hourglass'), timeButton = byId('time-view'), sandButton = byId('sand-view'), moneyButton = byId('money-view');
  var piggy = byId('piggy'), totalDisplay = byId('earnings-total'), tailButton = byId('pig-tail');
  var totalValue = byId('earnings-value'), calendarStatus = byId('calendar-status'), gain = byId('gain'), coin = byId('coin');
  var mode = 'hourglass', period = 'today';
  var nextCountdown = byId('next-work-countdown'), peekUntil = 0, nextTarget = 0, peekTimer = 0;
  function peekNextWorkday() {
    var now = new Date();
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
  var noseButton = byId('pig-nose'), salaryDialog = byId('salary-dialog'), salaryInput = byId('monthly-salary');
  function validSalary(value) {
    return /^\d+(?:\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100000000;
  }
  try {
    var saved = localStorage.getItem('countdown-view');
    if (['time', 'hourglass', 'money'].indexOf(saved) >= 0) mode = saved;
    if (localStorage.getItem('earnings-period') === 'month') period = 'month';
    var savedSalary = localStorage.getItem('monthly-salary');
    if (savedSalary && validSalary(savedSalary)) WorkEarnings.monthlySalary = Number(savedSalary);
  } catch (e) {}
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var savedBoost = null;
  try { savedBoost = localStorage.getItem('pig-overdrive-v1'); } catch (e) {}
  var boost = new BoostLedger(savedBoost, Date.now());
  function persistBoost() { try { localStorage.setItem('pig-overdrive-v1', boost.serialize()); } catch (e) {} }
  var pigEffects = new PigEffects(byId('pig-effects'), byId('money-atmosphere'), function () {
    boost.advance(Date.now(), WorkEarnings.monthlySalary);
    state = WorkEarnings.at(new Date(), WorkEarnings.monthlySalary);
    updateIncome(true);
  });
  piggy.classList.add('fx-ready');
  byId('pig-ear').addEventListener('click', function () {
    var d = boost.data;
    d.ear = (Number(d.ear) || 0) + 1;
    if (d.ear >= 18) { d.ear = 0; d.gold = !d.gold; }
    persistBoost(); updateIncome();
  });
  byId('pig-belly').addEventListener('click', function () {
    if (boost.data.phase !== 'idle' || !state || !state.earning) return;
    boost.data.belly = (Number(boost.data.belly) || 0) + 1;
    if (boost.data.belly >= 18) { boost.data.belly = 0; boost.trigger(Date.now(), WorkEarnings.monthlySalary); }
    persistBoost(); updateIncome();
  });
  var currency = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var animation = 0, lastFrame = -Infinity, working = false, elapsed = 0, measuredAt = 0, state;
  var renderer = new PixelHourglass(canvas);
  function render(timestamp) {
    animation = 0;
    if (!working || mode !== 'hourglass' || document.hidden) return;
    if (timestamp - lastFrame >= 1000 / 30) {
      renderer.draw((elapsed + (Date.now() - measuredAt) / 1000) / WorkClock.shift, reducedMotion.matches ? 0 : timestamp);
      lastFrame = timestamp;
    }
    if (!reducedMotion.matches) animation = requestAnimationFrame(render);
  }
  var displayedPeriod, displayedLook;
  function updateIncome(force) {
    if (!state) return;
    var look = boost.look();
    totalDisplay.setAttribute('aria-label', period === 'month' ? '本月累计收入' : '今日累计收入');
    byId('today-icon').style.display = period === 'month' ? 'none' : 'inline-block';
    byId('month-icon').style.display = period === 'month' ? 'inline-block' : 'none';
    tailButton.setAttribute('aria-label', period === 'month' ? '当前显示本月累计，拉动猪尾巴切换今日累计' : '当前显示今日累计，拉动猪尾巴切换本月累计');
    var clock = state.clock, dateKey = clock.year + '-' + pad(clock.month) + '-' + pad(clock.day);
    var ledgerKey = period === 'month' && state.period ? state.period + '-01' : dateKey;
    var value = state.available ? Math.max(0, state[period] + boost.adjustment(ledgerKey, period)) : 0;
    if (force || !pigEffects.active || mode !== 'money' || look === 'exhausted' || displayedPeriod !== period || displayedLook !== look) {
      MoneyDigits(totalValue, state.available ? '¥' + currency.format(value) : '—');
    }
    displayedPeriod = period; displayedLook = look;
    calendarStatus.hidden = state.available;
    calendarStatus.textContent = state.available ? '' : state.clock.year + ' 年工作日历待更新';
    MoneyDigits(gain, state.available ? '+¥' + state.rate.toFixed(4) : '');
    piggy.dataset.look = look;
    piggy.dataset.phase = boost.data.phase;
    piggy.dataset.coinFrequency = look === 'exhausted' ? '0' : look === 'gold' ? '6' : ['red', 'violet', 'cyan'].includes(look) ? '2' : '1';
    document.body.dataset.moneyLook = working && mode === 'money' ? look : 'normal';
    var art = { normal: 'piggy-bank.png', gold: 'piggy-gold.png', red: 'rage-red.png', violet: 'rage-violet.png', cyan: 'rage-cyan.png', exhausted: 'piggy-exhausted.png' }[look];
    if (byId('pig-art').getAttribute('src') !== art) byId('pig-art').setAttribute('src', art);
    var animate = Boolean(state.earning && working && mode === 'money' && !document.hidden && look !== 'exhausted');
    pigEffects.update(look, animate, working && mode === 'money', state.rate || 0, boost.data.phase === 'burst' ? boost.data.started : undefined);
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
  var pressing = false;
  noseButton.addEventListener('click', function () {
    if (pressing || salaryDialog.open) return;
    pressing = true;
    noseButton.classList.add('pressing');
    if (boost.look() !== 'normal') piggy.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(.985)' }, { transform: 'scaleX(1)' }], { duration: reducedMotion.matches ? 0 : 240 });
    setTimeout(function () {
      noseButton.classList.remove('pressing');
      pressing = false;
      salaryInput.value = String(WorkEarnings.monthlySalary);
      MoneyDigits(byId('salary-readout'), salaryInput.value);
      salaryDialog.showModal();
      salaryInput.focus();
      salaryInput.select();
    }, reducedMotion.matches ? 0 : 240);
  });
  function saveSalary() {
    boost.advance(Date.now(), WorkEarnings.monthlySalary);
    var value = salaryInput.value.trim();
    if (validSalary(value)) {
      WorkEarnings.monthlySalary = Number(value);
      try { localStorage.setItem('monthly-salary', String(WorkEarnings.monthlySalary)); } catch (e) {}
    }
    salaryDialog.close();
    persistBoost();
    tick();
    updateIncome(true);
  }
  salaryInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') { event.preventDefault(); saveSalary(); }
  });
  salaryInput.addEventListener('input', function () { MoneyDigits(byId('salary-readout'), salaryInput.value); });
  salaryDialog.addEventListener('click', function (event) {
    var box = salaryDialog.getBoundingClientRect();
    if (event.target === salaryDialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) saveSalary();
  });
  tailButton.addEventListener('click', function () {
    if (tugging) return;
    tugging = true;
    tailButton.classList.add('tugging');
    if (boost.look() !== 'normal') piggy.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: reducedMotion.matches ? 0 : 300 });
    setTimeout(function () {
      period = period === 'today' ? 'month' : 'today';
      try { localStorage.setItem('earnings-period', period); } catch (e) {}
      updateIncome(true);
      tailButton.classList.remove('tugging');
      tugging = false;
    }, reducedMotion.matches ? 0 : 300);
  });
  function pad(n) { return String(n).padStart(2, '0'); }
  function tick() {
    var now = new Date();
    boost.advance(now.getTime(), WorkEarnings.monthlySalary);
    persistBoost();
    state = WorkEarnings.at(now, WorkEarnings.monthlySalary);
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
    measuredAt = now.getTime();
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
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', refresh);
  loop();
})();
