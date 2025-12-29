const path = require('path');
const { readJsonFile, writeJsonFile, ensureDir } = require('../utils/fileStore');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// 确保数据目录存在
ensureDir(DATA_DIR);

function readMessages() {
  return readJsonFile(MESSAGES_FILE, []);
}

function writeMessages(messages) {
  const success = writeJsonFile(MESSAGES_FILE, messages);
  if (!success) {
    throw new Error('写入消息数据失败');
  }
}

// 生成唯一消息ID
function generateMessageId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  const counter = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `msg_${timestamp}_${random}_${counter}`;
}

// 发送消息到用户
function sendMessageToUser(userId, title, content) {
  const messages = readMessages();
  const message = {
    id: generateMessageId(),
    userId,
    title,
    content,
    isRead: false,
    createdAt: Date.now(),
  };
  messages.push(message);
  writeMessages(messages);
  return message;
}

// 获取用户的所有消息
function getUserMessages(userId) {
  const messages = readMessages();
  return messages.filter((m) => m.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

// 标记消息为已读
function markMessageAsRead(messageId) {
  const messages = readMessages();
  const message = messages.find((m) => m.id === messageId);
  if (message) {
    message.isRead = true;
    writeMessages(messages);
  }
  return message;
}

// 删除消息
function deleteMessage(messageId) {
  const messages = readMessages();
  const index = messages.findIndex((m) => m.id === messageId);
  if (index !== -1) {
    messages.splice(index, 1);
    writeMessages(messages);
    return true;
  }
  return false;
}

// 向所有用户发送消息
function sendMessageToAllUsers(title, content, userIds) {
  const messages = readMessages();
  const baseTimestamp = Date.now();
  const newMessages = userIds.map((userId, index) => ({
    id: `msg_${baseTimestamp}_${index}_${Math.random().toString(36).slice(2, 8)}_${userId}`,
    userId,
    title,
    content,
    isRead: false,
    createdAt: baseTimestamp + index, // 确保时间戳唯一
  }));
  messages.push(...newMessages);
  writeMessages(messages);
  return newMessages;
}

module.exports = {
  sendMessageToUser,
  getUserMessages,
  markMessageAsRead,
  deleteMessage,
  sendMessageToAllUsers,
};


