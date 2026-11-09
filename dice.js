(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const dialog = byId('dice-window');
  const form = byId('dice-form');
  const count = byId('dice-count');
  const upgradeOne = byId('dice-upgrade');
  const doubleSix = byId('dice-double');
  const submit = byId('dice-roll');
  const message = byId('dice-message');
  const wallet = PigWallet;
  const rules = XiabanWalletRules;
  const errors = {
    balance: '余额不足。',
    diceQuote: '可用赠礼已变化，请核对费用后再投。',
    diceCount: '请选择 1 至 ' + rules.diceLimit + ' 颗骰子。'
  };
  let busy = false;
  count.max = rules.diceLimit;

  function quote(inventory) {
    if (!inventory || !count.validity.valid) return null;
    return rules.diceQuote(inventory, { count: count.valueAsNumber, upgradeOne: upgradeOne.checked, doubleSix: doubleSix.checked });
  }

  function render() {
    const state = wallet.state();
    const inventory = state?.dice;
    byId('dice-inventory').textContent = inventory
      ? '免费骰子 ' + inventory.freeDice + ' 颗 · 1 点变 2 点券 ' + inventory.freeOne + ' 张 · 6 点返双倍券 ' + inventory.freeSix + ' 张'
      : '正在读取赠礼…';
    const current = quote(inventory);
    byId('dice-quote').textContent = current
      ? '本局 ' + current.cost + ' 元 · 可用余额 ' + wallet.read('balance').toFixed(2) + ' 元'
      : '请选择 1 至 ' + rules.diceLimit + ' 颗骰子。';
    submit.disabled = busy || !wallet.ready() || !current || current.cost * SkinCatalog.micro > state.balance;
    const last = inventory?.lastRoll;
    byId('dice-result').hidden = !last;
    if (last) {
      const net = last.payout - last.cost;
      byId('dice-result-text').textContent = '返还 ' + last.payout + ' 元 · 净额 ' + (net > 0 ? '+' : '') + net + ' 元';
      const faces = last.rolls.map(face => {
        const tile = document.createElement('span');
        tile.textContent = face;
        return tile;
      });
      byId('dice-faces').replaceChildren(...faces);
    }
  }

  async function act(action, options) {
    busy = true;
    message.textContent = '';
    render();
    try {
      await wallet.send(action, options);
    } catch (error) {
      message.textContent = errors[error.message] || '暂时无法读取或写入存档，请重试。';
      if (error.message === 'diceQuote') await wallet.sync().catch(() => {});
    } finally {
      busy = false;
      if (dialog.open) render();
    }
  }

  byId('dice-open').addEventListener('click', () => {
    dialog.showModal();
    if (!wallet.state()?.dice && !busy) act('diceWelcome', {});
    else render();
  });
  form.addEventListener('input', render);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const current = quote(wallet.state()?.dice);
    if (!busy && current) act('rollDice', current);
  });
  window.addEventListener('walletchange', () => { if (dialog.open) render(); });
})();
