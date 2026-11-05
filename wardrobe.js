(function () {
  'use strict';
  var catalog = SkinCatalog, wallet = PigWallet;
  var dialog = document.getElementById('skin-window'), open = document.getElementById('skin-open');
  var screen = document.getElementById('skin-screen'), heading = document.getElementById('skin-heading');
  var message = document.getElementById('skin-message'), credit = document.getElementById('skin-credit');
  var nav = document.getElementById('skin-nav');
  var pane = 'gallery', slot = 'pig', selected = null, drawCount = 1, lastDraw = null, busy = false;
  var money = new Intl.NumberFormat('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  var counts = [1,3,5,10];
  var errors = {
    storage:'无法读取本地存档，请检查浏览器的站点存储设置。',
    balance:'可用余额不足。', stock:'碎片或时长券不足。', locked:'这件皮肤当前无法装备。',
    owned:'已拥有这件皮肤。', cdkInvalid:'兑换码无效。', cdkUsed:'当前存档已使用此兑换码。',
    backup:'存档格式无效。请选择从此应用导出的 JSON 文件。',
    poolVersion:'奖池已更新，请刷新页面。', freeDraw:'这次免费机会已使用，已刷新库存。',
    exchange:'需要至少 2 个超出保留数量的专属碎片。'
  };
  function node(tag, className, value) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (value != null) element.textContent = value;
    return element;
  }
  function button(label, callback, disabled, className) {
    var element = node('button', className, label);
    element.type = 'button';
    element.disabled = Boolean(disabled);
    element.addEventListener('click', callback);
    return element;
  }
  function setMessage(text, error) {
    message.textContent = text || '';
    message.dataset.error = String(Boolean(error));
  }
  function quantity(key) { return wallet.state()?.stock[key] || 0; }
  function available(skin) {
    var current = wallet.state();
    return skin.id === 'G01' ? current?.goldUntil > wallet.now() : current?.owned.includes(skin.id);
  }
  function equipped(skin) {
    return wallet.state()?.equipped[skin.slot] === skin.id && available(skin);
  }
  function craftable(skin) { return skin.id !== 'C04' && skin.tier !== 'G'; }
  function fragments(skin) { return quantity(skin.id) + quantity(skin.tier); }
  function exchangeable(skin) {
    return Math.max(0, Math.floor((quantity(skin.id) - catalog.craftCost) / catalog.exchangeRate));
  }
  function expiry() {
    var ms = Math.max(0, (wallet.state()?.goldUntil || 0) - wallet.now());
    return ms ? Math.ceil(ms / 3600000) + ' 小时内' : '';
  }
  function tickets() {
    return Object.keys(wallet.state()?.stock || {}).filter(key => key.startsWith('G:'))
      .map(key => Number(key.slice(2))).sort((a,b) => a-b);
  }
  function art(skin, eager) {
    var wrap = node('div', 'skin-art skin-art-' + skin.slot);
    if (skin.effect) wrap.dataset.effect = skin.effect;
    var image = node('img');
    image.alt = '';
    image.loading = eager ? 'eager' : 'lazy';
    image.src = catalog.artUrl(skin.art);
    image.draggable = false;
    wrap.append(image);
    return wrap;
  }
  function status(skin) {
    if (equipped(skin)) return '已装备';
    if (available(skin)) return skin.tier === 'G' ? '剩余 ' + expiry() : '已获得';
    if (skin.id === 'C04') return (wallet.state()?.owned.filter(id => ['C01','C02','C03'].includes(id)).length || 0) + ' / 3 款炫彩猪皮';
    if (skin.tier === 'G') return tickets().length ? '有待激活时长券' : '未获得';
    return Math.min(fragments(skin), catalog.craftCost) + ' / ' + catalog.craftCost + ' 碎片';
  }
  function page(next) {
    pane = next;
    setMessage('');
    render();
    screen.scrollTop = 0;
    screen.focus({ preventScroll:true });
    if (next === 'machine') claimWelcome();
  }
  function claimWelcome() {
    var gifts = wallet.state()?.drawGifts;
    if (pane !== 'machine' || !dialog.open || !wallet.ready() || !gifts || gifts.welcomeClaimed || busy) return;
    mutate('welcome', {}, function (result) {
      if (result.added) {
        drawCount = 10;
        setMessage('首访赠送 1 次免费十连，随时可用。');
      }
    });
  }
  function useGift(count) {
    var gifts = wallet.state()?.drawGifts;
    return count === 1 ? Boolean(gifts?.singles) : count === 10 && Boolean(gifts?.tens);
  }
  function checkedInToday() {
    var gifts = wallet.state()?.drawGifts;
    var clock = WorkClock.read(new Date(wallet.now()));
    var today = [clock.year, String(clock.month).padStart(2, '0'), String(clock.day).padStart(2, '0')].join('-');
    return gifts?.day === today && gifts.checkedIn;
  }
  function tab(text, onClick, pressed) {
    var element = button(text, onClick, busy, 'skin-tab');
    element.setAttribute('aria-pressed', String(pressed));
    return element;
  }
  function drawGallery() {
    var tabs = node('div', 'skin-slots');
    tabs.append(tab('猪皮', () => { slot = 'pig'; render(); }, slot === 'pig'),
      tab('背景', () => { slot = 'background'; render(); }, slot === 'background'));
    var checkin = button('', function () {
      mutate('checkin', {}, function (result) {
        setMessage(result.added ? '签到成功，已存入 1 次免费单抽。' : '今天已经签到。');
      });
    }, busy, 'skin-checkin');
    checkin.dataset.checkin = '';
    tabs.append(checkin);
    screen.append(tabs);
    catalog.weights.forEach(function ([tier]) {
      var skins = Object.values(catalog.items).filter(skin => skin.tier === tier && skin.slot === slot);
      if (!skins.length) return;
      var group = node('section', 'skin-group');
      group.dataset.tier = tier;
      group.append(node('h3', 'skin-group-title', catalog.titles[tier] + ' / ' + skins.length));
      var grid = node('div', 'skin-grid');
      skins.forEach(function (skin) {
        var card = button('', () => { selected = skin; page('detail'); }, false, 'skin-card');
        card.dataset.id = skin.id;
        card.dataset.tier = tier;
        card.classList.toggle('skin-owned', available(skin));
        var label = node('div', 'skin-caption');
        label.append(node('strong', '', skin.name), node('span', '', status(skin)));
        card.append(art(skin), label);
        grid.append(card);
      });
      group.append(grid); screen.append(group);
    });
  }
  function rewardText(reward) {
    if (reward.kind === 'gold') return '黄金雨 ' + reward.hours + ' 小时券';
    if (reward.kind === 'credit') return '钱包余额 +¥' + money.format(reward.amount);
    if (reward.kind === 'draw') return (reward.count === 10 ? '免费十连' : '免费单抽') + ' × ' + reward.quantity;
    if (reward.kind === 'skin') return (reward.bonus ? '集齐解锁 · ' : '') + catalog.items[reward.skin].name;
    var target = catalog.items[reward.item];
    return (reward.duplicate ? '重复折算 · ' : '') +
      (target ? target.name : catalog.titles[reward.item] + '通用') + '碎片 × ' + reward.quantity;
  }
  function rewardList(rewards) { return rewards.map(rewardText).join('、'); }
  async function mutate(action, payload, done) {
    if (busy) return;
    busy = true;
    setMessage('正在处理…');
    render();
    try {
      var begin = performance.now();
      var result = await wallet.send(action, payload);
      if (action === 'draw' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        await new Promise(resolve => setTimeout(resolve, Math.max(0, 480 - (performance.now() - begin))));
      }
      done(result);
    } catch (error) {
      if (error.message === 'freeDraw') await wallet.sync().catch(() => {});
      setMessage(errors[error.message] || '操作未完成，请稍后再试。', true);
    } finally {
      busy = false;
      render();
    }
  }
  function drawDetail() {
    var skin = selected;
    var has = available(skin), wearing = equipped(skin), unavailable = busy || !wallet.ready();
    var box = node('div', 'skin-detail');
    box.dataset.tier = skin.tier;
    var sample = art(skin, true);
    sample.classList.add('skin-detail-art');
    var info = node('div', 'skin-detail-info');
    info.append(node('p', 'skin-kicker', skin.id + ' / ' + catalog.titles[skin.tier] + ' / ' + (skin.slot === 'pig' ? '猪皮' : '背景')),
      node('h3', '', skin.name), node('p', '', catalog.effects[skin.id] || '静态像素外观'),
      node('p', 'skin-detail-status', status(skin)));
    if (skin.id === 'C04') info.append(node('p', '', '集齐三款炫彩猪皮自动解锁，也可用指定 CDK 获得。'));
    if (skin.id === 'G01' && has) {
      info.append(node('p', '', '到期时间 ' + new Date(wallet.state().goldUntil).toLocaleString('zh-CN', { timeZone:'Asia/Shanghai' }) + '（北京时间）'));
    }
    var actions = node('div', 'skin-actions');
    actions.append(button('换上', () => mutate('equip', { slot:skin.slot, skin:skin.id }, () => setMessage('已换上「' + skin.name + '」。')),
      unavailable || !has || wearing, 'skin-primary'),
    button('脱下', () => mutate('equip', { slot:skin.slot, skin:null }, () => setMessage('已恢复初始外观。')), unavailable || !wearing));
    if (craftable(skin) && skin.tier !== 'C') {
      info.append(node('p', '', '专属 ' + quantity(skin.id) + ' 个 · 同品质通用 ' + quantity(skin.tier) + ' 个'));
      var exchange = exchangeable(skin);
      if (exchange) {
        info.append(node('p', '', '保留 ' + catalog.craftCost + ' 个专属碎片，超出部分可按 2:1 兑换。'));
        actions.append(button('换成 ' + exchange + ' 个通用碎片', () => mutate('exchange', { skin:skin.id },
          r => setMessage('已用 ' + r.spent + ' 个「' + skin.name + '」碎片兑换 · ' + rewardList(r.rewards))), unavailable));
      }
    }
    if (craftable(skin) && !has) {
      actions.append(button('用 10 个碎片兑换', () => mutate('craft', { skin:skin.id }, r => setMessage(rewardList(r.rewards))),
        unavailable || fragments(skin) < catalog.craftCost));
    }
    if (skin.id === 'G01') tickets().forEach(function (hours) {
      actions.append(button((has ? '续期 ' : '激活 ') + hours + ' 小时券 × ' + quantity('G:' + hours),
        () => mutate('gold', { hours:hours }, () => setMessage('黄金套装已启用。')), unavailable));
    });
    info.append(actions); box.append(sample, info); screen.append(box);
  }
  function oddsTable() {
    var details = node('details', 'skin-disclosure');
    details.append(node('summary', '', '查看概率与价格'));
    var table = node('table', 'skin-odds');
    var header = node('tr');
    ['品质', '出蛋率', '蛋内奖品'].forEach(label => { var th = node('th', '', label); th.scope = 'col'; header.append(th); });
    var thead = node('thead'); thead.append(header); table.append(thead);
    var tbody = node('tbody');
    catalog.weights.forEach(function ([tier, weight]) {
      var tr = node('tr');
      var outcomes = tier === 'G' ? '100% 黄金 24 小时券' : tier === 'C' ?
        catalog.odds.C[0] + '% 猪皮 · ' + catalog.odds.C[1] + '% 通用碎片 × 1' :
        catalog.odds[tier][0] + '% 皮肤 · ' + catalog.odds[tier][1] + '% 专属碎片 × 2 · ' + catalog.odds[tier][2] + '% 专属碎片 × 5';
      [catalog.titles[tier], weight + '%', outcomes].forEach(text => tr.append(node('td', '', text)));
      tbody.append(tr);
    });
    table.append(tbody);
    details.append(table, node('p', '', counts.map(count => count + ' 枚 ¥' + catalog.prices[count]).join('  /  ') + '。每枚独立抽取。'));
    return details;
  }
  function groupedRewards(rewards) {
    var lines = [];
    var fragments = new Map();
    rewards.forEach(function (reward) {
      if (reward.kind !== 'fragment') { lines.push(reward); return; }
      var key = reward.item + '|' + Boolean(reward.duplicate);
      if (fragments.has(key)) fragments.get(key).quantity += reward.quantity;
      else {
        var line = { ...reward };
        fragments.set(key, line);
        lines.push(line);
      }
    });
    return lines;
  }
  function drawResult(result) {
    var list = node('ol', 'skin-eggs');
    list.dataset.count = String(result.eggs.length);
    result.eggs.forEach(function (egg, index) {
      var entry = node('li');
      entry.dataset.tier = egg.tier;
      var number = node('span', 'skin-egg-index', String(index + 1).padStart(2, '0'));
      var capsule = node('img', 'skin-capsule');
      capsule.src = catalog.artUrl('skins/egg-' + egg.tier + '.png');
      capsule.alt = '';
      var text = node('div', 'skin-egg-items');
      text.append(node('strong', '', catalog.titles[egg.tier] + '蛋'));
      groupedRewards(egg.rewards).forEach(reward => text.append(node('span', '',
        reward.kind === 'skin' && !reward.bonus ? '新皮肤 · ' + rewardText(reward) : rewardText(reward))));
      entry.append(number, capsule, text);
      list.append(entry);
    });
    return list;
  }
  function drawResultScreen() {
    var result = lastDraw;
    var rewards = result.eggs.flatMap(egg => egg.rewards);
    var featured = rewards.filter(r => r.kind === 'skin').sort((a,b) =>
      catalog.weights.findIndex(([tier]) => tier === a.skin[0]) - catalog.weights.findIndex(([tier]) => tier === b.skin[0]))[0];
    var hero = node('section', 'skin-result-hero');
    if (featured) {
      var skin = catalog.items[featured.skin];
      hero.dataset.tier = skin.tier;
      var artPreview = art(skin, true);
      artPreview.classList.add('skin-detail-art', 'skin-result-art');
      hero.append(artPreview, node('h3', '', skin.name), node('span', 'skin-result-tag', featured.bonus ? '集齐奖励' : '新皮肤'));
    } else {
      hero.append(node('h3', '', '本次获得'));
      var shards = rewards.reduce((total, reward) => total + (reward.kind === 'fragment' ? reward.quantity : 0), 0);
      var tickets = rewards.filter(r => r.kind === 'gold').length;
      hero.append(node('p', '', [shards ? '碎片 ' + shards + ' 个' : '', tickets ? '黄金时长券 ' + tickets + ' 张' : ''].filter(Boolean).join(' · ')));
    }
    screen.append(hero, drawResult(result), button('返回扭蛋机', () => page('machine'), false, 'skin-result-back'));
  }
  function drawMachine() {
    var machine = node('div', 'skin-machine');
    machine.classList.toggle('skin-drawing', busy);
    var image = node('img', 'skin-machine-art');
    image.src = catalog.artUrl('skins/machine.png');
    image.alt = '像素扭蛋机';
    var actions = node('div', 'skin-machine-actions');
    var count = button('数量 ' + drawCount + ' 枚', function () {
      drawCount = counts[(counts.indexOf(drawCount) + 1) % counts.length]; render();
      screen.querySelector('.skin-machine-actions button')?.focus();
    }, busy);
    var draw = button('扭蛋', function () {
      mutate('draw', { count:drawCount, version:catalog.version, free:useGift(drawCount) }, result => {
        lastDraw = result;
        page('result');
      });
    }, busy || !wallet.ready(), 'skin-primary');
    draw.dataset.draw = '';
    actions.append(count, draw);
    var eligibility = node('p', 'skin-eligibility');
    machine.append(image, actions, eligibility);
    screen.append(machine);
    screen.append(oddsTable());
    var history = node('details', 'skin-disclosure');
    history.append(node('summary', '', '最近扭蛋记录'));
    var saved = wallet.state()?.history || [];
    if (!saved.length) history.append(node('p', '', '暂无记录。'));
    saved.forEach(function (result) {
      history.append(button(result.eggs.length + ' 枚 · ' + (result.amount ? '¥' + result.amount : '免费'), function () {
        lastDraw = result;
        page('result');
      }, busy, 'skin-history-entry'));
    });
    screen.append(history);
  }
  function drawCdk() {
    var block = node('div', 'skin-cdk');
    var form = node('form');
    var label = node('label', '', '输入 CDK');
    label.htmlFor = 'skin-code';
    var input = node('input');
    input.id = 'skin-code'; input.name = 'code'; input.type = 'text';
    input.maxLength = 80; input.autocomplete = 'off'; input.spellcheck = false;
    input.required = true; input.placeholder = '兑换码';
    var submit = node('button', 'skin-primary', '兑换'); submit.type = 'submit';
    submit.disabled = busy || !wallet.ready();
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var code = input.value.trim();
      if (!code) return;
      mutate('redeem', { code:code }, r => setMessage('兑换成功 · ' + rewardList(r.rewards)));
    });
    var row = node('div', 'skin-actions'); row.append(input, submit); form.append(label, row);
    var backup = node('div', 'skin-actions');
    var file = node('input');
    file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
    file.addEventListener('change', async function () {
      var selectedFile = file.files[0];
      if (!selectedFile || busy) return;
      if (selectedFile.size > 2 * 1024 * 1024) { setMessage(errors.backup, true); file.value = ''; return; }
      if (!confirm('导入会替换当前本地存档。确定继续吗？')) { file.value = ''; return; }
      busy = true; render();
      try {
        await wallet.importSave(await selectedFile.text());
        setMessage('存档已导入。');
      } catch (error) {
        setMessage(errors[error.message] || '读取存档失败。', true);
      } finally { busy = false; render(); }
    });
    backup.append(button('导出存档', async function () {
      try {
        var url = URL.createObjectURL(new Blob([await wallet.exportSave()], { type:'application/json' }));
        var link = node('a'); link.href = url; link.download = 'xiaban-save.json';
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage('存档已导出。');
      } catch (error) { setMessage(errors[error.message] || '导出存档失败。', true); }
    }, busy || !wallet.ready()), button('导入存档', () => file.click(), busy), file);
    block.append(form, node('p', 'skin-device', wallet.state()?.id ? '存档识别码 ' + wallet.state().id : '正在读取存档识别码…'), backup);
    screen.append(block);
  }
  function paint() {
    var value = wallet.read('balance');
    credit.textContent = value == null ? '余额 —' : '余额 ¥' + money.format(value);
    var checkin = screen.querySelector('[data-checkin]');
    if (checkin) {
      var signed = checkedInToday();
      checkin.disabled = busy || !wallet.ready() || signed;
      if (checkin.dataset.signed !== String(Boolean(signed))) {
        checkin.dataset.signed = String(Boolean(signed));
        checkin.replaceChildren(node('span', '', signed ? '今日已签到' : '每日签到'));
        if (!signed) checkin.append(node('span', 'skin-result-tag', '单抽 +1'));
      }
    }
    var draw = screen.querySelector('[data-draw]');
    if (draw) {
      var free = useGift(drawCount);
      draw.textContent = free ? '免费扭蛋' : '扭蛋 · ¥' + catalog.prices[drawCount];
      draw.disabled = busy || !wallet.ready() || (!free && (value == null || value < catalog.prices[drawCount]));
      var hint = screen.querySelector('.skin-eligibility');
      var gifts = wallet.state()?.drawGifts;
      var labels = [];
      if (gifts?.tens) labels.push('免费十连 × ' + gifts.tens);
      if (gifts?.singles) labels.push('免费单抽 × ' + gifts.singles);
      if (!wallet.ready()) labels.push('读取本地存档后可以扭蛋');
      else if (!free && value != null && value < catalog.prices[drawCount]) labels.push('此档余额不足');
      hint.textContent = labels.join(' · ');
    }
  }
  function render() {
    var scroll = screen.scrollTop;
    dialog.dataset.pane = pane;
    heading.textContent = pane === 'result' ? (lastDraw.eggs.length === 10 ? '十连结果' : lastDraw.eggs.length === 1 ? '单抽结果' : lastDraw.eggs.length + ' 连结果') :
      { gallery:'皮肤管理', detail:'皮肤详情', machine:'扭蛋机', cdk:'兑换 CDK' }[pane];
    var source = document.getElementById('skin-result-source');
    var sourceLabels = { welcome:'首访赠送', checkin:'签到赠送', cdk:'兑换码赠送' };
    source.hidden = pane !== 'result' || !sourceLabels[lastDraw?.source];
    source.textContent = sourceLabels[lastDraw?.source] || '';
    credit.hidden = pane === 'result';
    nav.hidden = pane === 'result';
    nav.replaceChildren(tab('图鉴', () => page('gallery'), pane === 'gallery' || pane === 'detail'),
      tab('扭蛋机', () => page('machine'), pane === 'machine'),
      tab('兑换 CDK', () => page('cdk'), pane === 'cdk'));
    screen.replaceChildren();
    if (pane === 'gallery') drawGallery();
    if (pane === 'detail') drawDetail();
    if (pane === 'machine') drawMachine();
    if (pane === 'result') drawResultScreen();
    if (pane === 'cdk') drawCdk();
    paint();
    screen.scrollTop = scroll;
  }
  var ready = null;
  window.addEventListener('walletchange', function (event) {
    var stored = wallet.ready();
    if (!dialog.open || busy) { ready = stored; return; }
    if (ready !== stored) {
      setMessage(stored ? '' : errors.storage, !stored);
      render();
    } else if (event.detail && (pane === 'gallery' || pane === 'detail' || pane === 'machine')) render();
    else paint();
    ready = stored;
    if (stored && pane === 'machine') claimWelcome();
  });
  open.addEventListener('click', function () {
    dialog.showModal();
    page('gallery');
    ready = wallet.ready();
    wallet.sync().then(render).catch(error => setMessage(errors[error.message] || '暂时无法读取钱包。', true));
  });
  document.getElementById('skin-close').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('close', function () { open.focus(); });
  setInterval(function () {
    if (dialog.open) {
      paint();
      if (pane === 'detail' && selected?.id === 'G01' && screen.querySelector('.skin-detail-status')?.textContent !== status(selected)) render();
    }
  }, 1000);
})();
