(function () {
  'use strict';
  var byId = function (id) { return document.getElementById(id); };
  var stage = byId('stage'), countdown = byId('countdown'), image = byId('off-work'), views = byId('views');
  var canvas = byId('hourglass'), timeButton = byId('time-view'), sandButton = byId('sand-view'), moneyButton = byId('money-view');
  var piggy = byId('piggy'), totalDisplay = byId('earnings-total'), tailButton = byId('pig-tail');
  var totalValue = byId('earnings-value'), calendarStatus = byId('calendar-status'), gain = byId('gain'), coin = byId('coin');
  var mode = 'hourglass', period = 'today';
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
  function updateIncome() {
    if (!state) return;
    totalDisplay.setAttribute('aria-label', period === 'month' ? '本月累计收入' : '今日累计收入');
    byId('today-icon').style.display = period === 'month' ? 'none' : 'inline-block';
    byId('month-icon').style.display = period === 'month' ? 'inline-block' : 'none';
    tailButton.setAttribute('aria-label', period === 'month' ? '当前显示本月累计，拉动猪尾巴切换今日累计' : '当前显示今日累计，拉动猪尾巴切换本月累计');
    totalValue.textContent = state.available ? '¥' + currency.format(state[period]) : '—';
    calendarStatus.hidden = state.available;
    calendarStatus.textContent = state.available ? '' : state.clock.year + ' 年工作日历待更新';
    gain.textContent = state.available ? '+¥' + state.rate.toFixed(4) : '';
    var animate = Boolean(state.earning && working && mode === 'money' && !document.hidden);
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
    setTimeout(function () {
      noseButton.classList.remove('pressing');
      pressing = false;
      salaryInput.value = String(WorkEarnings.monthlySalary);
      salaryDialog.showModal();
      salaryInput.focus();
      salaryInput.select();
    }, reducedMotion.matches ? 0 : 240);
  });
  function saveSalary() {
    var value = salaryInput.value.trim();
    if (validSalary(value)) {
      WorkEarnings.monthlySalary = Number(value);
      try { localStorage.setItem('monthly-salary', String(WorkEarnings.monthlySalary)); } catch (e) {}
    }
    salaryDialog.close();
    tick();
  }
  salaryInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') { event.preventDefault(); saveSalary(); }
  });
  salaryDialog.addEventListener('click', function (event) {
    var box = salaryDialog.getBoundingClientRect();
    if (event.target === salaryDialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) saveSalary();
  });
  tailButton.addEventListener('click', function () {
    if (tugging) return;
    tugging = true;
    tailButton.classList.add('tugging');
    setTimeout(function () {
      period = period === 'today' ? 'month' : 'today';
      try { localStorage.setItem('earnings-period', period); } catch (e) {}
      updateIncome();
      tailButton.classList.remove('tugging');
      tugging = false;
    }, reducedMotion.matches ? 0 : 300);
  });
  function pad(n) { return String(n).padStart(2, '0'); }
  function tick() {
    var now = new Date();
    state = WorkEarnings.at(now, WorkEarnings.monthlySalary);
    var clock = state.clock;
    working = clock.open;
    stage.hidden = !working;
    views.hidden = !working;
    image.hidden = working;
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
