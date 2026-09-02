// ====== 全服公告存储 · v1.05 · 2026-09-02 ======
// 内存存储（重启清空）——公告是时效性广播消息，不需要持久化。
// 上限 50 条，超出自动丢弃最旧的。
// 游戏前端轮询 /api/announce，对比 latestId 发现新公告并 toast 提示。

const list = [];
let seq = 0;
const MAX = 50;

function add(content) {
  const item = { id: ++seq, content, ts: Date.now() };
  list.push(item);
  if (list.length > MAX) list.shift();
  return item;
}

function all() {
  return list;
}

function latestId() {
  return seq;
}

module.exports = { add, all, latestId, MAX };
