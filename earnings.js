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
    var elapsed = isWorkday ? clock.elapsed : 0;
    var beforeReset = clock.day < workdays[0] || (clock.day === workdays[0] && clock.second < START);
    var completed = workdays.filter(function (d) { return d < clock.day; }).length;
    var rate = salary / workdays.length / SHIFT;
    var previousMonth = clock.month === 1 ? 12 : clock.month - 1;
    var period = beforeReset ? (clock.month === 1 ? clock.year - 1 : clock.year) + '-' + pad(previousMonth) : clock.year + '-' + pad(clock.month);
    return { clock: clock, available: true, earning: isWorkday && clock.open && salary > 0, rate: rate,
      today: elapsed * rate, month: beforeReset ? salary : Math.min(salary, (completed * SHIFT + elapsed) * rate),
      progress: (completed * SHIFT + elapsed) / (workdays.length * SHIFT), workdays: workdays.length, period: period };
  }
  root.WorkClock = { read: read, start: START, end: END, shift: SHIFT };
  root.WorkEarnings = { at: at, days: days, monthlySalary: 10000 };
})(typeof window === 'undefined' ? globalThis : window);
