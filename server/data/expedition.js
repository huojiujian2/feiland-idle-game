// ====== 远征静态配置 ======
// @file data/expedition
// @module data-expedition
// @description 远征 4 区域 / 10 事件 / 3 时长 / 首领配置（T-102 v4）

const EXPEDITION_DURATIONS = [
  { key: '30m', ms: 30 * 60 * 1000, label: '30分钟' },
  { key: '2h', ms: 2 * 60 * 60 * 1000, label: '2小时' },
  { key: '8h', ms: 8 * 60 * 60 * 1000, label: '8小时' },
];
const MIN_EXPEDITION_MS = 10 * 60 * 1000;

const EXPEDITION_AREAS = {
  verdant_border: {
    id: 'verdant_border', name: '丰饶边境', desc: '低风险新手区，稳定产出', minLevel: 1, risk: 'low',
    base: { gold: [80, 150], exp: 120, drops: [{ name: '草药', rate: 0.3 }, { name: '兽皮', rate: 0.3 }] },
    boss: { name: '边境巡林客', hpRate: 3.5, atkRate: 1.8, expMul: 0.5, goldMul: 0.5, chance: 0.10 },
    eventPool: ['evt_battle_slime', 'evt_merchant', 'evt_weather', 'evt_route', 'evt_treasure', 'evt_scout'],
  },
  ancient_ruins: {
    id: 'ancient_ruins', name: '古代遗迹', desc: '中风险遗迹机关区', minLevel: 15, risk: 'mid',
    base: { gold: [200, 400], exp: 400, drops: [{ name: '青铜矿', rate: 0.15 }, { name: '飞龙鳞片', rate: 0.15 }] },
    boss: { name: '遗迹守卫', hpRate: 4, atkRate: 2, expMul: 0.8, goldMul: 0.8, chance: 0.30 },
    eventPool: ['evt_battle_slime', 'evt_ruins_trap', 'evt_merchant', 'evt_treasure', 'evt_scout', 'evt_dragon_sign'],
  },
  abyss_rift: {
    id: 'abyss_rift', name: '深渊裂隙', desc: '高风险稀有材料区', minLevel: 30, risk: 'high',
    base: { gold: [350, 600], exp: 800, drops: [{ name: '深渊之石', rate: 0.1 }, { name: '法则碎片', rate: 0.1 }], goldLoss: { chance: 0.4, rate: 0.3 } },
    boss: { name: '裂隙潜伏者', hpRate: 4.5, atkRate: 2.2, expMul: 1.0, goldMul: 1.0, chance: 0.35 },
    eventPool: ['evt_ruins_trap', 'evt_weather', 'evt_route', 'evt_abyss_whisper', 'evt_battle_slime', 'evt_scout'],
  },
  dragon_nest: {
    id: 'dragon_nest', name: '巨龙巢穴', desc: '高概率首领挑战区', minLevel: 50, risk: 'high',
    base: { gold: [500, 900], exp: 1200, drops: [{ name: '龙鳞', rate: 0.08 }, { name: '龙血', rate: 0.08 }] },
    boss: { name: '雏龙', hpRate: 5, atkRate: 2.5, expMul: 1.2, goldMul: 1.2, chance: 0.60 },
    eventPool: ['evt_battle_slime', 'evt_dragon_sign', 'evt_abyss_whisper', 'evt_weather', 'evt_route', 'evt_rescue'],
  },
};

const EXPEDITION_EVENTS = [
  {
    id: 'evt_battle_slime', type: '战斗', title: '史莱姆群', desc: '前方泥泞中涌出大量史莱姆，挡住去路。',
    choices: [
      { id: 'a', label: '稳妥推进', risk: 'low', rewardHint: '稳定获得少量金币', timeDelta: 0, template: { goldRange: [20, 50], expRange: [10, 30], bossChanceDelta: 0 } },
      { id: 'b', label: '强行突破', risk: 'high', rewardHint: '高收益但可能受伤', timeDelta: '-10%', template: { goldRange: [60, 120], expRange: [30, 60], lossRateRange: [0, 0.15], bossChanceDelta: 0 } },
    ],
  },
  {
    id: 'evt_merchant', type: '商人', title: '流浪商人', desc: '一位背着行囊的流浪商人向你兜售货物。',
    choices: [
      { id: 'a', label: '交易', risk: 'mid', rewardHint: '消耗金币获得材料', timeDelta: 0, template: { costGold: 50, material: { name: '草药', count: 2 }, bossChanceDelta: 0 } },
      { id: 'b', label: '拒绝', risk: 'low', rewardHint: '无事发生', timeDelta: 0, template: { goldRange: [0, 0] } },
    ],
  },
  {
    id: 'evt_ruins_trap', type: '遗迹', title: '机关密室', desc: '古老的密室布满机关，中央石台似乎藏有宝物。',
    choices: [
      { id: 'a', label: '破解机关', risk: 'high', rewardHint: '敏捷判定，成功得宝箱，失败损失金币', timeDelta: 0, template: { goldRange: [80, 150], failGoldRange: [-80, -40], bossChanceDelta: 0 } },
      { id: 'b', label: '绕行', risk: 'low', rewardHint: '耗时增加', timeDelta: 10 * 60 * 1000, template: { goldRange: [10, 20] } },
    ],
  },
  {
    id: 'evt_rescue', type: '救援', title: '受伤旅人', desc: '路边有旅人受伤倒地，向你求助。',
    choices: [
      { id: 'a', label: '救助', risk: 'mid', rewardHint: '耗时但有善报', timeDelta: 10 * 60 * 1000, template: { goldRange: [30, 60], expRange: [20, 40] } },
      { id: 'b', label: '观望', risk: 'low', rewardHint: '无事发生', timeDelta: 0, template: { goldRange: [0, 0] } },
    ],
  },
  {
    id: 'evt_weather', type: '天气', title: '突变天气', desc: '天空突然乌云密布，暴雨将至。',
    choices: [
      { id: 'a', label: '冒雨前进', risk: 'high', rewardHint: '风险前行', timeDelta: 0, template: { goldRange: [40, 80], lossRateRange: [0, 0.1] } },
      { id: 'b', label: '就地休整', risk: 'low', rewardHint: '等待雨停，耗时', timeDelta: 15 * 60 * 1000, template: { goldRange: [10, 20] } },
    ],
  },
  {
    id: 'evt_route', type: '路线', title: '岔路口', desc: '前方出现两条路，一条捷径一条大路。',
    choices: [
      { id: 'a', label: '捷径', risk: 'high', rewardHint: '提前到达，高风险', timeDelta: -10 * 60 * 1000, template: { goldRange: [50, 100], lossRateRange: [0, 0.1] } },
      { id: 'b', label: '大路', risk: 'low', rewardHint: '稳定前行', timeDelta: 0, template: { goldRange: [20, 40] } },
    ],
  },
  {
    id: 'evt_treasure', type: '遗迹', title: '废弃宝箱', desc: '角落里有一个布满灰尘的宝箱。',
    choices: [
      { id: 'a', label: '开启', risk: 'mid', rewardHint: '概率陷阱', timeDelta: 0, template: { goldRange: [60, 120], failGoldRange: [-40, -20] } },
      { id: 'b', label: '留给后来人', risk: 'low', rewardHint: '无事发生', timeDelta: 0, template: { goldRange: [0, 0] } },
    ],
  },
  {
    id: 'evt_scout', type: '战斗', title: '斥候遭遇', desc: '敌方斥候发现了你的踪迹。',
    choices: [
      { id: 'a', label: '交涉', risk: 'mid', rewardHint: '策略判定', timeDelta: 0, template: { goldRange: [30, 60], expRange: [10, 20] } },
      { id: 'b', label: '驱逐', risk: 'high', rewardHint: '战斗驱逐', timeDelta: 0, template: { goldRange: [50, 90], expRange: [20, 40] } },
    ],
  },
  {
    id: 'evt_abyss_whisper', type: '战斗', title: '深渊低语', desc: '耳边传来低沉的呢喃，诱惑你倾听深渊。',
    choices: [
      { id: 'a', label: '倾听', risk: 'high', rewardHint: '高风险稀有材料', timeDelta: 0, template: { goldRange: [40, 80], material: { name: '深渊之石', count: 1 }, lossRateRange: [0, 0.1] } },
      { id: 'b', label: '屏蔽', risk: 'low', rewardHint: '无事发生', timeDelta: 0, template: { goldRange: [10, 20] } },
    ],
  },
  {
    id: 'evt_dragon_sign', type: '遗迹', title: '龙痕', desc: '地面出现巨大的龙爪痕迹，龙息尚温。',
    choices: [
      { id: 'a', label: '追踪', risk: 'mid', rewardHint: '首领概率+0.2', timeDelta: 0, template: { goldRange: [30, 60], bossChanceDelta: 0.2 } },
      { id: 'b', label: '绕开', risk: 'low', rewardHint: '避开风险', timeDelta: 0, template: { goldRange: [10, 20] } },
    ],
  },
];

function getExpeditionConfig() {
  return { areas: EXPEDITION_AREAS, events: EXPEDITION_EVENTS, durations: EXPEDITION_DURATIONS, minMs: MIN_EXPEDITION_MS };
}

module.exports = { EXPEDITION_AREAS, EXPEDITION_EVENTS, EXPEDITION_DURATIONS, MIN_EXPEDITION_MS, getExpeditionConfig };
