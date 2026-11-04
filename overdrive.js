(function (root) {
  'use strict';
  function Ledger(saved, now) {
    this.data = { last: now, phase: 'idle', left: 0, debt: 0, entries: {}, gold: false, ear: 0, belly: 0, theme: 'red' };
    try {
      var s = typeof saved === 'string' ? JSON.parse(saved) : saved;
      if (s && Number.isFinite(s.last) && ['idle', 'burst', 'rest'].indexOf(s.phase) >= 0 && Number.isFinite(s.debt) && s.debt >= 0 && Number.isFinite(s.left) && s.left >= 0 && s.left <= 5 && s.entries && typeof s.entries === 'object') {
        this.data = s;
        if (!['red', 'violet', 'cyan'].includes(s.theme)) s.theme = 'red';
      }
    } catch (e) {}
  }
  Ledger.prototype.advance = function (now, salary) {
    var d = this.data;
    if (now <= d.last) return;
    if (d.phase !== 'idle') {
      root.WorkEarnings.segments(d.last, now, salary).forEach(function (segment) {
        var seconds = (segment.end - segment.start) / 1000, rate = segment.rate, delta = 0;
        if (d.phase === 'burst' && rate > 0) {
          var burst = Math.min(d.left, seconds);
          delta += 19 * rate * burst;
          d.debt += 19 * rate * burst;
          d.left = Math.max(0, d.left - burst);
          seconds -= burst;
          if (d.left < 1e-9) { d.left = 0; d.phase = d.debt > 1e-9 ? 'rest' : 'idle'; }
        }
        if (d.phase === 'rest' && rate > 0 && seconds > 0) {
          var repaid = Math.min(d.debt, rate * seconds);
          delta -= repaid;
          d.debt = Math.max(0, d.debt - repaid);
          if (d.debt < 1e-9) { d.debt = 0; d.phase = 'idle'; }
        }
        if (delta) d.entries[segment.key] = (Number(d.entries[segment.key]) || 0) + delta;
      });
    }
    d.last = now;
  };
  Ledger.prototype.trigger = function (now, salary, random) {
    this.advance(now, salary);
    var d = this.data, state = root.WorkEarnings.at(new Date(now), salary);
    if (d.phase !== 'idle' || !state.earning) return false;
    d.phase = 'burst'; d.left = 5; d.debt = 0; d.started = now;
    d.theme = ['red', 'violet', 'cyan'][Math.min(2, Math.floor((random || Math.random)() * 3))];
    return true;
  };
  Ledger.prototype.adjustment = function (date, period) {
    var key = date.slice(0, period === 'month' ? 7 : 10), total = 0, entries = this.data.entries;
    Object.keys(entries).forEach(function (k) { if (k.indexOf(key) === 0 && Number.isFinite(entries[k])) total += entries[k]; });
    return total;
  };
  Ledger.prototype.look = function () {
    var d = this.data;
    return d.phase === 'burst' ? d.theme : d.phase === 'rest' ? 'exhausted' : d.gold ? 'gold' : 'normal';
  };
  Ledger.prototype.serialize = function () { return JSON.stringify(this.data); };
  root.BoostLedger = Ledger;
})(typeof window === 'undefined' ? globalThis : window);
