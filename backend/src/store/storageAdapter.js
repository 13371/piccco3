// 存储适配器 - 支持数据库和文件存储的切换
const logger = require('../utils/logger');

// 从环境变量读取存储模式
const STORAGE_MODE = process.env.STORAGE_MODE || 'file'; // 'file', 'db', 'dual'

// 动态导入存储实现
let fileUserStore = null;
let fileUserDataStore = null;
let fileMessageStore = null;
let fileMessageHistoryStore = null;

let dbUserDao = null;
let dbUserDataDao = null;
let dbMessageDao = null;
let dbMessageHistoryDao = null;

// 延迟加载，避免在文件模式下加载数据库依赖
function loadFileStores() {
  if (!fileUserStore) {
    fileUserStore = require('./userStore');
    fileUserDataStore = require('./userDataStore');
    fileMessageStore = require('./messageStore');
    fileMessageHistoryStore = require('./messageHistoryStore');
  }
}

function loadDbDaos() {
  if (!dbUserDao) {
    try {
      dbUserDao = require('../db/dao/userDao');
      dbUserDataDao = require('../db/dao/userDataDao');
      dbMessageDao = require('../db/dao/messageDao');
      dbMessageHistoryDao = require('../db/dao/messageHistoryDao');
    } catch (error) {
      logger.error('storageAdapter', '加载数据库DAO失败', error);
      throw error;
    }
  }
}

/**
 * 用户存储适配器
 */
const userStoreAdapter = {
  async createUser(data) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbUserDao.createUser(data);
    } else if (STORAGE_MODE === 'dual') {
      // 双写模式：同时写入文件和数据库
      loadDbDaos();
      const [fileResult, dbResult] = await Promise.allSettled([
        fileUserStore.createUser(data),
        dbUserDao.createUser(data),
      ]);
      
      if (fileResult.status === 'rejected') {
        logger.error('storageAdapter', '文件存储写入失败', fileResult.reason);
      }
      if (dbResult.status === 'rejected') {
        logger.error('storageAdapter', '数据库存储写入失败', dbResult.reason);
      }
      
      // 优先返回数据库结果，如果失败则返回文件结果
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      // 文件模式
      return await fileUserStore.createUser(data);
    }
  },

  async findUserByEmail(email) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbUserDao.findUserByEmail(email);
    } else if (STORAGE_MODE === 'dual') {
      // 双读模式：优先从数据库读取，失败则从文件读取
      loadDbDaos();
      try {
        return await dbUserDao.findUserByEmail(email);
      } catch (error) {
        logger.warn('storageAdapter', '从数据库读取失败，回退到文件', error);
        return await fileUserStore.findUserByEmail(email);
      }
    } else {
      return await fileUserStore.findUserByEmail(email);
    }
  },

  async findUserById(id) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbUserDao.findUserById(id);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      try {
        return await dbUserDao.findUserById(id);
      } catch (error) {
        logger.warn('storageAdapter', '从数据库读取失败，回退到文件', error);
        return await fileUserStore.findUserById(id);
      }
    } else {
      return await fileUserStore.findUserById(id);
    }
  },

  async verifyPassword(user, password) {
    loadFileStores();
    return await fileUserStore.verifyPassword(user, password);
  },

  async getAllUsers() {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbUserDao.getAllUsers();
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      return await dbUserDao.getAllUsers();
    } else {
      return fileUserStore.getAllUsers();
    }
  },

  async filterUsers(options) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbUserDao.filterUsers(options);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      return await dbUserDao.filterUsers(options);
    } else {
      return fileUserStore.filterUsers(options);
    }
  },

  async banUser(userId, reason) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbUserDao.banUser(userId, reason);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      const [fileResult, dbResult] = await Promise.allSettled([
        fileUserStore.banUser(userId, reason),
        dbUserDao.banUser(userId, reason),
      ]);
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      return fileUserStore.banUser(userId, reason);
    }
  },

  async unbanUser(userId) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbUserDao.unbanUser(userId);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      const [fileResult, dbResult] = await Promise.allSettled([
        fileUserStore.unbanUser(userId),
        dbUserDao.unbanUser(userId),
      ]);
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      return fileUserStore.unbanUser(userId);
    }
  },

  async deleteUser(userId) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      // 数据库模式下，外键约束会自动删除相关数据
      return await dbUserDao.deleteUser(userId);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      // 双写模式：同时删除文件和数据库中的数据
      const [fileResult, dbResult] = await Promise.allSettled([
        fileUserStore.deleteUser(userId),
        dbUserDao.deleteUser(userId),
      ]);
      
      if (fileResult.status === 'rejected') {
        logger.error('storageAdapter', '文件存储删除用户失败', fileResult.reason);
      }
      if (dbResult.status === 'rejected') {
        logger.error('storageAdapter', '数据库存储删除用户失败', dbResult.reason);
      }
      
      // 优先返回数据库结果，如果失败则返回文件结果
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      // 文件模式：使用原有的删除逻辑（会清理相关数据）
      return await fileUserStore.deleteUser(userId);
    }
  },

  async updatePassword(email, newPassword) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbUserDao.updatePassword(email, newPassword);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      const [fileResult, dbResult] = await Promise.allSettled([
        fileUserStore.updatePassword(email, newPassword),
        dbUserDao.updatePassword(email, newPassword),
      ]);
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      return await fileUserStore.updatePassword(email, newPassword);
    }
  },

  async updateUser(userId, updates) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbUserDao.updateUser(userId, updates);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      const [fileResult, dbResult] = await Promise.allSettled([
        fileUserStore.updateUser(userId, updates),
        dbUserDao.updateUser(userId, updates),
      ]);
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      return fileUserStore.updateUser(userId, updates);
    }
  },
};

/**
 * 用户数据存储适配器
 */
const userDataStoreAdapter = {
  async getUserData(userId) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbUserDataDao.getUserData(userId);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      try {
        return await dbUserDataDao.getUserData(userId);
      } catch (error) {
        logger.warn('storageAdapter', '从数据库读取失败，回退到文件', error);
        return await fileUserDataStore.getUserData(userId);
      }
    } else {
      return await fileUserDataStore.getUserData(userId);
    }
  },

  async getUserDataIncremental(userId, lastSyncAt) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbUserDataDao.getUserDataIncremental(userId, lastSyncAt);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      try {
        return await dbUserDataDao.getUserDataIncremental(userId, lastSyncAt);
      } catch (error) {
        logger.warn('storageAdapter', '增量同步失败，回退到完整同步', error);
        // 回退到完整同步
        return await this.getUserData(userId);
      }
    } else {
      // 文件模式不支持增量同步，返回完整数据
      return await fileUserDataStore.getUserData(userId);
    }
  },

  async saveUserData(userId, data) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbUserDataDao.saveUserData(userId, data);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      const [fileResult, dbResult] = await Promise.allSettled([
        fileUserDataStore.saveUserData(userId, data),
        dbUserDataDao.saveUserData(userId, data),
      ]);
      
      if (fileResult.status === 'rejected') {
        logger.error('storageAdapter', '文件存储写入失败', fileResult.reason);
      }
      if (dbResult.status === 'rejected') {
        logger.error('storageAdapter', '数据库存储写入失败', dbResult.reason);
      }
      
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      return await fileUserDataStore.saveUserData(userId, data);
    }
  },

  async updateUserData(userId, updates) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbUserDataDao.updateUserData(userId, updates);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      const [fileResult, dbResult] = await Promise.allSettled([
        fileUserDataStore.updateUserData(userId, updates),
        dbUserDataDao.updateUserData(userId, updates),
      ]);
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      return await fileUserDataStore.updateUserData(userId, updates);
    }
  },

  async deleteUserData(userId) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbUserDataDao.deleteUserData(userId);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      const [fileResult, dbResult] = await Promise.allSettled([
        fileUserDataStore.deleteUserData(userId),
        dbUserDataDao.deleteUserData(userId),
      ]);
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      return fileUserDataStore.deleteUserData(userId);
    }
  },
};

/**
 * 消息存储适配器
 */
const messageStoreAdapter = {
  async sendMessageToUser(userId, title, content) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbMessageDao.sendMessageToUser(userId, title, content);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      const [fileResult, dbResult] = await Promise.allSettled([
        fileMessageStore.sendMessageToUser(userId, title, content),
        dbMessageDao.sendMessageToUser(userId, title, content),
      ]);
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      return fileMessageStore.sendMessageToUser(userId, title, content);
    }
  },

  async getUserMessages(userId) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbMessageDao.getUserMessages(userId);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      try {
        return await dbMessageDao.getUserMessages(userId);
      } catch (error) {
        logger.warn('storageAdapter', '从数据库读取失败，回退到文件', error);
        return fileMessageStore.getUserMessages(userId);
      }
    } else {
      return fileMessageStore.getUserMessages(userId);
    }
  },

  async markMessageAsRead(messageId) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbMessageDao.markMessageAsRead(messageId);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      const [fileResult, dbResult] = await Promise.allSettled([
        fileMessageStore.markMessageAsRead(messageId),
        dbMessageDao.markMessageAsRead(messageId),
      ]);
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      return fileMessageStore.markMessageAsRead(messageId);
    }
  },

  async deleteMessage(messageId) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbMessageDao.deleteMessage(messageId);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      const [fileResult, dbResult] = await Promise.allSettled([
        fileMessageStore.deleteMessage(messageId),
        dbMessageDao.deleteMessage(messageId),
      ]);
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      return fileMessageStore.deleteMessage(messageId);
    }
  },

  async deleteUserMessages(userId) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbMessageDao.deleteUserMessages(userId);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      const [fileResult, dbResult] = await Promise.allSettled([
        fileMessageStore.deleteUserMessages(userId),
        dbMessageDao.deleteUserMessages(userId),
      ]);
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      return fileMessageStore.deleteUserMessages(userId);
    }
  },

  async sendMessageToAllUsers(title, content, userIds) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbMessageDao.sendMessageToAllUsers(title, content, userIds);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      const [fileResult, dbResult] = await Promise.allSettled([
        fileMessageStore.sendMessageToAllUsers(title, content, userIds),
        dbMessageDao.sendMessageToAllUsers(title, content, userIds),
      ]);
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      return fileMessageStore.sendMessageToAllUsers(title, content, userIds);
    }
  },
};

/**
 * 消息历史存储适配器
 */
const messageHistoryStoreAdapter = {
  async addMessageHistory(data) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbMessageHistoryDao.addMessageHistory(data);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      const [fileResult, dbResult] = await Promise.allSettled([
        fileMessageHistoryStore.addMessageHistory(data),
        dbMessageHistoryDao.addMessageHistory(data),
      ]);
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      return fileMessageHistoryStore.addMessageHistory(data);
    }
  },

  async addBroadcastHistory(data) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbMessageHistoryDao.addBroadcastHistory(data);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      const [fileResult, dbResult] = await Promise.allSettled([
        fileMessageHistoryStore.addBroadcastHistory(data),
        dbMessageHistoryDao.addBroadcastHistory(data),
      ]);
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      return fileMessageHistoryStore.addBroadcastHistory(data);
    }
  },

  async getMessageHistory(options) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbMessageHistoryDao.getMessageHistory(options);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      try {
        return await dbMessageHistoryDao.getMessageHistory(options);
      } catch (error) {
        logger.warn('storageAdapter', '从数据库读取失败，回退到文件', error);
        return fileMessageHistoryStore.getMessageHistory(options);
      }
    } else {
      return fileMessageHistoryStore.getMessageHistory(options);
    }
  },

  async deleteHistory(historyId) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbMessageHistoryDao.deleteHistory(historyId);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      const [fileResult, dbResult] = await Promise.allSettled([
        fileMessageHistoryStore.deleteHistory(historyId),
        dbMessageHistoryDao.deleteHistory(historyId),
      ]);
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      return fileMessageHistoryStore.deleteHistory(historyId);
    }
  },

  async deleteUserHistory(userId) {
    loadFileStores();
    
    if (STORAGE_MODE === 'db') {
      loadDbDaos();
      return await dbMessageHistoryDao.deleteUserHistory(userId);
    } else if (STORAGE_MODE === 'dual') {
      loadDbDaos();
      const [fileResult, dbResult] = await Promise.allSettled([
        fileMessageHistoryStore.deleteUserHistory(userId),
        dbMessageHistoryDao.deleteUserHistory(userId),
      ]);
      return dbResult.status === 'fulfilled' ? dbResult.value : fileResult.value;
    } else {
      return fileMessageHistoryStore.deleteUserHistory(userId);
    }
  },
};

module.exports = {
  userStoreAdapter,
  userDataStoreAdapter,
  messageStoreAdapter,
  messageHistoryStoreAdapter,
  STORAGE_MODE,
};

