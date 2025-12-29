const path = require('path');
const { readJsonFile, writeJsonFile, ensureDir } = require('../utils/fileStore');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const MESSAGE_HISTORY_FILE = path.join(DATA_DIR, 'message-history.json');

// 确保数据目录存在
ensureDir(DATA_DIR);

function readHistory() {
  return readJsonFile(MESSAGE_HISTORY_FILE, []);
}

function writeHistory(history) {
  const success = writeJsonFile(MESSAGE_HISTORY_FILE, history);
  if (!success) {
    throw new Error('写入消息历史数据失败');
  }
}

// 生成唯一历史记录ID
function generateHistoryId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  const counter = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `hist_${timestamp}_${random}_${counter}`;
}

// 记录发送消息历史
function addMessageHistory({ userId, title, content, type = 'single' }) {
  const history = readHistory();
  const record = {
    id: generateHistoryId(),
    userId: userId || null, // null 表示群发
    title,
    content,
    type, // 'single' 单个用户, 'broadcast' 群发
    createdAt: Date.now(),
  };
  history.unshift(record); // 最新的在前面
  writeHistory(history);
  return record;
}

// 记录群发消息历史
function addBroadcastHistory({ title, content, userCount }) {
  const history = readHistory();
  const record = {
    id: generateHistoryId(),
    userId: null,
    title,
    content,
    type: 'broadcast',
    userCount,
    createdAt: Date.now(),
  };
  history.unshift(record);
  writeHistory(history);
  return record;
}

// 获取所有发送历史（支持分页和过滤）
function getMessageHistory({ page = 1, limit = 20, type, userId } = {}) {
  let history = readHistory();
  
  // 按类型过滤
  if (type) {
    history = history.filter((h) => h.type === type);
  }
  
  // 按用户ID过滤
  if (userId) {
    history = history.filter((h) => h.userId === userId);
  }
  
  // 分页
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const start = (pageNum - 1) * limitNum;
  const end = start + limitNum;
  const paginatedHistory = history.slice(start, end);
  
  return {
    history: paginatedHistory,
    total: history.length,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(history.length / limitNum),
  };
}

// 删除历史记录
function deleteHistory(historyId) {
  const history = readHistory();
  const index = history.findIndex((h) => h.id === historyId);
  if (index !== -1) {
    history.splice(index, 1);
    writeHistory(history);
    return true;
  }
  return false;
}

module.exports = {
  addMessageHistory,
  addBroadcastHistory,
  getMessageHistory,
  deleteHistory,
};




