// ====== 共享可注入状态（测试 seam） ======
// 所有模块共享同一份 _now/_rand/_dropRand/_uidSeq
let _now = () => Date.now();
let _rand = Math.random;
let _dropRand = Math.random;
let _uidSeq = 0;
let _testMode = false;

function getNow() { return _now(); }
function __setNow(fn) { _now = fn; _testMode = true; }
function __setRandom(fn) { _rand = fn; _testMode = true; }
function __setDropRandom(fn) { _dropRand = fn; _testMode = true; }
function __resetSeams() {
  _now = () => Date.now();
  _rand = Math.random;
  _dropRand = Math.random;
  _uidSeq = 0;
  _testMode = false;
}
function genUid() {
  return getNow() + '_' + (_uidSeq++) + '_' + _rand().toString(36).substr(2, 6);
}

module.exports = {
  getNow,
  __setNow,
  __setRandom,
  __setDropRandom,
  __resetSeams,
  genUid,
  // 直接获取随机函数（用于 _calculateIdleBatch 等）
  getRand: () => _rand,
  getDropRand: () => _dropRand,
  isTestMode: () => _testMode,
};
