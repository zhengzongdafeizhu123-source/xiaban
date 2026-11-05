(function (root) {
  'use strict';
  var groups = [
    ['C', 1, 3, ['螺钿潮纹','光栅变图','深海梳光','彩潮观测站']],
    ['R', 7, 5, ['朱漆莲纹','蓝晒蕨影','街机记分牌','深潜舱','夜菌','雨夜车窗']],
    ['G', 10, 1, ['黄金雨']],
    ['P', 32, 8, ['紫晶','电路板','磁带','青花','蓝图','月岩','苔砖','琥珀','等高线','城市剪影','终端','天文台']],
    ['B', 50, 15, ['石板蓝','薄荷','珊瑚','奶油','长春花蓝','苔绿','陶橙','冰蓝','炭黑','梅紫','海军蓝','鼠尾草绿','淡桃','混凝土灰','奶油黄','网格','细扫描线','棋盘格','斜纹','点阵纸']]
  ];
  var items = Object.fromEntries(groups.flatMap(function (group) {
    return group[3].map(function (name, index) {
      var tier = group[0], id = tier + String(index + 1).padStart(2, '0');
      return [id, { id: id, tier: tier, name: name, slot: index < group[2] ? 'pig' : 'background',
        effect: ['C','R','G'].includes(tier) ? id.toLowerCase() : '',
        art: tier === 'G' ? 'piggy-gold.png' : 'skins/' + id + '.png' }];
    });
  }));
  var titles = { C: '炫彩', R: '红色', G: '金色', P: '紫色', B: '蓝色' };
  var effects = {
    C01: '贝壳碎片沿潮纹依次反光', C02: '交错色条在方格与折线间移动', C03: '虹彩光点沿弧线前进',
    C04: '贝壳波纹、色带与点光缓慢掠过视野边缘', R01: '暖光扫过朱漆莲瓣',
    R02: '细光沿蕨叶掠过', R03: '琥珀点阵沿外壳逐格点亮', R04: '少量气泡在鼻尖外侧上浮',
    R05: '菌帽缓慢发亮，孢子沿边缘飘散', R06: '雨线滑落，站灯沿窗边移动', G01: '金身、两条金币流和全屏黄金雨'
  };
  var odds = { C: [10,90], R: [15,55,30], G: [100], P: [15,55,30], B: [15,55,30] };
  var prices = { 1:100, 3:280, 5:450, 10:900 };
  var pool = Object.fromEntries(groups.map(function (group) {
    var tier = group[0];
    return [tier, Object.keys(items).filter(function (id) { return id[0] === tier && id !== 'C04'; })];
  }));
  function artUrl(file) {
    return file + '?v=10';
  }
  var catalog = { items: items, titles: titles, effects: effects, odds: odds, prices: prices, pool: pool, artUrl: artUrl,
    weights: groups.map(function (group) { return [group[0], group[1]]; }),
    version: 'skin-pool-2', micro: 1000000, craftCost: 10, exchangeRate: 2, duplicates: { C:3, R:2, P:2, B:1 } };
  if (typeof module !== 'undefined') module.exports = catalog;
  else root.SkinCatalog = catalog;
})(globalThis);
