(function (root) {
  'use strict';
  const { items, pool, odds, prices, weights, version, micro, duplicates, craftCost, exchangeRate } = root.SkinCatalog;
  const hour = 3600000, shift = 9 * hour, salary = WorkEarnings.monthlySalary;
  const earningsStart = Date.parse('2026-11-02T09:00:00+08:00');
  const pad = n => String(n).padStart(2, '0');
  const dayKey = clock => clock.year + '-' + pad(clock.month) + '-' + pad(clock.day);
  const epoch = n => Number.isSafeInteger(n) && n >= 0 && n <= 8640000000000000;
  const nonnegative = n => Number.isSafeInteger(n) && n >= 0;
  const positive = (n, max) => Number.isSafeInteger(n) && n > 0 && n <= max;
  const record = value => value && Object.getPrototypeOf(value) === Object.prototype;
  const ownsSkin = (id, slot) => Object.hasOwn(items, id) && items[id].slot === slot;
  const permanent = id => typeof id === 'string' && Object.hasOwn(items, id) && id !== 'G01';
  const fragment = id => ['C', 'R', 'P', 'B'].includes(id) || permanent(id) && ['R','P','B'].includes(items[id].tier);
  const digest = id => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id);
  const dateKey = key => typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key);
  const drawSources = ['welcome', 'checkin', 'paid', 'cdk'];
  const fail = code => { throw Error(code); };

  function newSave() {
    return {
      schema: 1, id: crypto.randomUUID(), since: earningsStart, cursor: earningsStart, balance: 0, income: {}, owned: [], stock: {},
      equipped: { pig: null, background: null }, goldUntil: 0, welcome: false, checkin: '', redeemed: [], history: []
    };
  }

  function cumulativeAt(ms, year, month, days) {
    const worked = days.reduce((sum, day) => sum + Math.max(0, Math.min(shift, ms - Date.UTC(year, month - 1, day, 1))), 0);
    return Number(BigInt(salary * micro) * BigInt(worked) / BigInt(days.length * shift));
  }

  function earned(from, to) {
    const result = { cursor: from, entries: [] };
    if (to <= from) return result;
    const first = WorkClock.read(new Date(from)), last = WorkClock.read(new Date(to));
    const lastDay = Date.UTC(last.year, last.month - 1, last.day);
    for (let stamp = Date.UTC(first.year, first.month - 1, first.day); stamp <= lastDay; stamp += 24 * hour) {
      const date = new Date(stamp);
      const year = date.getUTCFullYear(), month = date.getUTCMonth() + 1, day = date.getUTCDate();
      const days = WorkEarnings.days(year, month);
      if (!days?.length) break;
      const start = Math.max(from, stamp + hour), end = Math.min(to, stamp + 10 * hour);
      if (end > start && days.includes(day)) {
        const amount = cumulativeAt(end, year, month, days) - cumulativeAt(start, year, month, days);
        if (amount) result.entries.push({ day: dayKey({ year, month, day }), amount });
      }
      result.cursor = Math.min(to, stamp + 16 * hour); // Next Beijing midnight.
    }
    return result;
  }

  function creditIncome(save, entries) {
    for (const { day, amount } of entries) {
      save.income[day] = (save.income[day] || 0) + amount;
      save.balance += amount;
    }
  }

  function settle(save, now) {
    if (save.since > earningsStart) {
      // Fill the missing interval before the old account's original start.
      const backfill = earned(save.backfillCursor ?? earningsStart, Math.min(save.since, now));
      creditIncome(save, backfill.entries);
      if (backfill.cursor === save.since) {
        save.since = earningsStart;
        delete save.backfillCursor;
      } else {
        save.backfillCursor = backfill.cursor;
      }
    }
    const due = earned(save.cursor, now);
    creditIncome(save, due.entries);
    save.cursor = due.cursor;
    if (save.equipped.pig === 'G01' && save.goldUntil <= now) save.equipped.pig = null;
  }

  function view(save, now) {
    const sample = WorkEarnings.at(new Date(now), salary);
    const day = dayKey(sample.clock), month = sample.period || day.slice(0, 7);
    const due = earned(save.cursor, now);
    let balance = save.balance, today = save.income[day] || 0, monthly = 0;
    for (const [key, amount] of Object.entries(save.income)) {
      if (key.slice(0, 7) === month && key <= day) monthly += amount;
    }
    for (const entry of due.entries) {
      balance += entry.amount;
      if (entry.day === day) today += entry.amount;
      if (entry.day.slice(0, 7) === month) monthly += entry.amount;
    }
    return {
      id: save.id, balance, today, month: monthly, owned: save.owned, stock: save.stock, equipped: save.equipped,
      goldUntil: save.goldUntil, history: save.history, calendarReady: sample.available && due.cursor >= now,
      drawGifts: { welcomeClaimed: save.welcome, checkedIn: save.checkin >= day, day,
        singles: count(save, 'free:1') + count(save, 'free:cdk:1'), tens: count(save, 'free:10') + count(save, 'free:cdk:10') }
    };
  }

  const count = (save, item) => save.stock[item] || 0;
  function adjustStock(save, item, change) {
    const quantity = count(save, item) + change;
    if (!nonnegative(quantity)) fail('stock');
    if (quantity) save.stock[item] = quantity;
    else delete save.stock[item];
  }
  function fragments(save, item, quantity) {
    adjustStock(save, item, quantity);
    return { kind: 'fragment', item, quantity };
  }
  function grant(save, skin) {
    if (save.owned.includes(skin)) {
      if (skin === 'C04') fail('owned');
      const tier = items[skin].tier;
      return [{ ...fragments(save, tier === 'C' ? tier : skin, duplicates[tier]), from: skin, duplicate: true }];
    }
    save.owned.push(skin);
    const rewards = [{ kind: 'skin', skin }];
    if (!save.owned.includes('C04') && pool.C.every(id => save.owned.includes(id))) {
      save.owned.push('C04');
      rewards.push({ kind: 'skin', skin: 'C04', bonus: true });
    }
    return rewards;
  }
  function uniform(max) {
    const sample = new Uint32Array(1), limit = 2 ** 32 - (2 ** 32 % max);
    do crypto.getRandomValues(sample); while (sample[0] >= limit);
    return sample[0] % max;
  }
  function pick(chances, random) {
    let value = random(chances.reduce((sum, weight) => sum + weight, 0));
    return chances.findIndex(weight => (value -= weight) < 0);
  }
  function drawOne(save, random) {
    const tier = weights[pick(weights.map(entry => entry[1]), random)][0];
    const outcome = pick(odds[tier], random);
    const pickSkin = () => pool[tier][random(pool[tier].length)];
    let rewards;
    if (tier === 'G') {
      adjustStock(save, 'G:24', 1);
      rewards = [{ kind: 'gold', hours: 24 }];
    } else if (outcome === 0) rewards = grant(save, pickSkin());
    else if (tier === 'C') rewards = [fragments(save, 'C', 1)];
    else rewards = Array.from({ length: outcome === 1 ? 2 : 5 }, () => fragments(save, pickSkin(), 1));
    return { tier, rewards };
  }
  function draw(save, payload, now, random) {
    const n = payload.count, price = prices[n];
    if (!Number.isInteger(n) || !Object.hasOwn(prices, n)) fail('count');
    if (payload.version !== version) fail('poolVersion');
    let source = 'paid';
    if (payload.free === true) {
      if (n !== 1 && n !== 10) fail('count');
      const gift = 'free:' + n, coupon = 'free:cdk:' + n;
      const useGift = count(save, gift) > 0;
      if (!useGift && !count(save, coupon)) fail('freeDraw');
      adjustStock(save, useGift ? gift : coupon, -1);
      source = useGift ? (n === 10 ? 'welcome' : 'checkin') : 'cdk';
    } else {
      if (save.balance < price * micro) fail('balance');
      save.balance -= price * micro;
    }
    const result = { amount: source === 'paid' ? price : 0, source, now, eggs: Array.from({ length: n }, () => drawOne(save, random)) };
    save.history.unshift(result);
    save.history.length = Math.min(save.history.length, 10);
    return result;
  }

  function validReward(reward) {
    if (!record(reward)) return false;
    switch (reward.kind) {
      case 'skin': return permanent(reward.skin);
      case 'fragment': return fragment(reward.item) && positive(reward.quantity, 10000);
      case 'gold': return positive(reward.hours, 8760);
      case 'credit': return positive(reward.amount, 10000);
      case 'draw': return [1, 10].includes(reward.count) && positive(reward.quantity, 100);
      default: return false;
    }
  }
  function redeem(save, key) {
    const reward = root.XiabanCdk?.[key];
    if (!digest(key) || !validReward(reward)) fail('cdkInvalid');
    if (save.redeemed.includes(key)) fail('cdkUsed');
    let rewards = [reward];
    if (reward.kind === 'skin') rewards = grant(save, reward.skin);
    if (reward.kind === 'fragment') rewards = [fragments(save, reward.item, reward.quantity)];
    if (reward.kind === 'gold') adjustStock(save, 'G:' + reward.hours, 1);
    if (reward.kind === 'draw') adjustStock(save, 'free:cdk:' + reward.count, reward.quantity);
    if (reward.kind === 'credit') {
      const balance = save.balance + reward.amount * micro;
      if (!nonnegative(balance)) fail('balance');
      save.balance = balance;
    }
    save.redeemed.push(key);
    return { rewards };
  }

  function perform(save, action, payload, now, random = uniform) {
    const skin = Object.hasOwn(items, payload.skin) ? items[payload.skin] : null;
    switch (action) {
      case 'welcome':
        if (save.welcome) return { added: false };
        save.welcome = true;
        adjustStock(save, 'free:10', 1);
        return { added: true };
      case 'checkin': {
        const day = dayKey(WorkClock.read(new Date(now)));
        if (save.checkin >= day) return { added: false };
        save.checkin = day;
        adjustStock(save, 'free:1', 1);
        return { added: true };
      }
      case 'draw': return draw(save, payload, now, random);
      case 'equip':
        if (!['pig', 'background'].includes(payload.slot)) fail('slot');
        if (payload.skin !== null) {
          if (!skin || skin.slot !== payload.slot) fail('slot');
          if (skin.id === 'G01' ? save.goldUntil <= now : !save.owned.includes(skin.id)) fail('locked');
        }
        save.equipped[payload.slot] = payload.skin;
        return {};
      case 'craft': {
        if (!skin || skin.id === 'C04' || skin.tier === 'G') fail('craft');
        if (save.owned.includes(skin.id)) fail('owned');
        const specific = skin.tier === 'C' ? 0 : Math.min(craftCost, count(save, skin.id));
        if (specific + count(save, skin.tier) < craftCost) fail('stock');
        if (specific) adjustStock(save, skin.id, -specific);
        adjustStock(save, skin.tier, -(craftCost - specific));
        return { rewards: grant(save, skin.id) };
      }
      case 'exchange': {
        if (!skin || !['R', 'P', 'B'].includes(skin.tier)) fail('exchange');
        const quantity = Math.floor((count(save, skin.id) - craftCost) / exchangeRate);
        if (quantity < 1) fail('exchange');
        adjustStock(save, skin.id, -quantity * exchangeRate);
        return { spent: quantity * exchangeRate, rewards: [fragments(save, skin.tier, quantity)] };
      }
      case 'gold':
        if (!positive(payload.hours, 8760)) fail('stock');
        adjustStock(save, 'G:' + payload.hours, -1);
        save.goldUntil = Math.max(now, save.goldUntil) + payload.hours * hour;
        save.equipped.pig = 'G01';
        return { goldUntil: save.goldUntil };
      case 'redeem': return redeem(save, payload.digest);
      default: fail('route');
    }
  }

  function validSave(save) {
    if (!record(save) || save.schema !== 1 ||
        typeof save.id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(save.id) ||
        !epoch(save.since) || !epoch(save.cursor) || save.cursor < save.since || !epoch(save.goldUntil) ||
        (save.backfillCursor !== undefined &&
          (!epoch(save.backfillCursor) || save.backfillCursor < earningsStart || save.backfillCursor >= save.since)) ||
        !nonnegative(save.balance) || typeof save.welcome !== 'boolean' ||
        !(save.checkin === '' || dateKey(save.checkin))) return false;
    if (!record(save.income) || !Object.entries(save.income).every(([day, amount]) => dateKey(day) && nonnegative(amount)) ||
        !Array.isArray(save.owned) || !save.owned.every(permanent) ||
        !record(save.equipped) || !['pig', 'background'].every(slot => {
          const id = save.equipped[slot];
          return id === null || ownsSkin(id, slot) && (id === 'G01' || save.owned.includes(id));
        })) return false;
    if (!record(save.stock) || !Object.entries(save.stock).every(([item, n]) => nonnegative(n) &&
        (fragment(item) || /^free:(cdk:)?(1|10)$/.test(item) || /^G:[1-9]\d{0,3}$/.test(item) && positive(Number(item.slice(2)), 8760))) ||
        !Array.isArray(save.redeemed) || !save.redeemed.every(digest)) return false;
    return Array.isArray(save.history) && save.history.length <= 10 && save.history.every(draw =>
      record(draw) && nonnegative(draw.amount) && epoch(draw.now) && drawSources.includes(draw.source) &&
      Array.isArray(draw.eggs) && Object.hasOwn(prices, draw.eggs.length) && draw.eggs.every(egg =>
        record(egg) && Object.hasOwn(odds, egg.tier) && Array.isArray(egg.rewards) && egg.rewards.every(validReward)));
  }

  root.XiabanWalletRules = { newSave, settle, view, perform, validSave, validReward };
})(globalThis);
