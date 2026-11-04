(function (root) {
  'use strict';
  var START = 9 * 3600, END = 18 * 3600, SHIFT = END - START;
  var formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  function pad(n) { return String(n).padStart(2, '0'); }
  function read(now) {
    var parts = {};
    formatter.formatToParts(now).forEach(function (p) { parts[p.type] = p.value; });
    var second = (Number(parts.hour) % 24) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
    return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), second: second,
      open: second >= START && second < END, elapsed: Math.max(0, Math.min(SHIFT, second - START)),
      remaining: Math.max(0, END - second) };
  }
  var cache = {};
  function days(year, month) {
    var key = year + '-' + pad(month);
    if (cache[key]) return cache[key];
    var calendar = root.WorkCalendars[String(year)];
    if (!calendar) return null;
    var total = new Date(Date.UTC(year, month, 0)).getUTCDate(), result = [];
    for (var day = 1; day <= total; day++) {
      var md = pad(month) + '-' + pad(day);
      var weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      var holiday = calendar.holidays.some(function (range) { return md >= range[0] && md <= range[1]; });
      if (calendar.workdays.indexOf(md) >= 0 || (weekday > 0 && weekday < 6 && !holiday)) result.push(day);
    }
    cache[key] = result;
    return result;
  }
  function at(now, salary) {
    var clock = read(now);
    var workdays = days(clock.year, clock.month);
    if (!workdays || !workdays.length) return { clock: clock, available: false, earning: false };
    var isWorkday = workdays.indexOf(clock.day) >= 0;
    var elapsed = isWorkday ? Math.min(SHIFT, clock.elapsed + now.getMilliseconds() / 1000) : 0;
    var beforeReset = clock.day < workdays[0] || (clock.day === workdays[0] && clock.second < START);
    var completed = workdays.filter(function (d) { return d < clock.day; }).length;
    var rate = salary / workdays.length / SHIFT;
    var previousMonth = clock.month === 1 ? 12 : clock.month - 1;
    var period = beforeReset ? (clock.month === 1 ? clock.year - 1 : clock.year) + '-' + pad(previousMonth) : clock.year + '-' + pad(clock.month);
    return { clock: clock, available: true, earning: isWorkday && clock.open && salary > 0, rate: rate,
      today: elapsed * rate, month: beforeReset ? salary : Math.min(salary, (completed * SHIFT + elapsed) * rate),
      progress: (completed * SHIFT + elapsed) / (workdays.length * SHIFT), workdays: workdays.length, period: period };
  }
  function nextStart(now) {
    var clock = read(now);
    for (var offset = 0; offset <= 370; offset++) {
      var date = new Date(Date.UTC(clock.year, clock.month - 1, clock.day + offset));
      var year = date.getUTCFullYear(), month = date.getUTCMonth() + 1, day = date.getUTCDate();
      var workdays = days(year, month);
      if (!workdays) return null;
      var start = Date.UTC(year, month - 1, day, 1); // 09:00 Asia/Shanghai.
      if (start > now.getTime() && workdays.indexOf(day) >= 0) return start;
    }
    return null;
  }
  root.WorkClock = { read: read, nextStart: nextStart, start: START, end: END, shift: SHIFT };
  function segments(from, to, salary) {
    if (to <= from) return [];
    var first = read(new Date(from)), last = read(new Date(to)), result = [];
    var begin = Date.UTC(first.year, first.month - 1, first.day);
    var finish = Date.UTC(last.year, last.month - 1, last.day);
    for (var stamp = begin; stamp <= finish; stamp += 86400000) {
      var d = new Date(stamp), year = d.getUTCFullYear(), month = d.getUTCMonth() + 1, day = d.getUTCDate();
      var workdays = days(year, month);
      if (!workdays) break;
      if (workdays.indexOf(day) < 0) continue;
      var start = Math.max(from, stamp + 3600000), end = Math.min(to, stamp + 36000000);
      if (end > start) result.push({ start: start, end: end, key: year + '-' + pad(month) + '-' + pad(day), rate: salary / workdays.length / SHIFT });
    }
    return result;
  }
  root.WorkEarnings = { at: at, days: days, segments: segments, monthlySalary: 10000 };
})(typeof window === 'undefined' ? globalThis : window);
