// 数据迁移脚本：从JSON文件迁移到PostgreSQL数据库
const path = require('path');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { initPool, query, closePool } = require('../src/db/config');
const { createSchema, isInitialized } = require('../src/db/migrations');
const logger = require('../src/utils/logger');

// 导入文件存储
const fileUserStore = require('../src/store/userStore');
const fileUserDataStore = require('../src/store/userDataStore');
const fileMessageStore = require('../src/store/messageStore');
const fileMessageHistoryStore = require('../src/store/messageHistoryStore');

// 导入数据库DAO
const dbUserDao = require('../src/db/dao/userDao');
const dbUserDataDao = require('../src/db/dao/userDataDao');
const dbMessageDao = require('../src/db/dao/messageDao');
const dbMessageHistoryDao = require('../src/db/dao/messageHistoryDao');

/**
 * 迁移用户数据
 */
async function migrateUsers() {
  logger.info('migrate', '开始迁移用户数据...');
  
  try {
    const users = fileUserStore.getAllUsers();
    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // 从文件存储读取完整用户信息（包括密码）
        const fullUser = await fileUserStore.findUserById(user.id);
        if (!fullUser) {
          logger.warn('migrate', `用户 ${user.id} 不存在，跳过`);
          continue;
        }

        // 检查数据库中是否已存在
        const existing = await dbUserDao.findUserById(user.id);
        if (existing) {
          logger.debug('migrate', `用户 ${user.id} 已存在，跳过`);
          continue;
        }

        // 迁移到数据库
        await dbUserDao.createUser({
          id: fullUser.id,
          email: fullUser.email,
          username: fullUser.username,
          password: fullUser.password,
          createdAt: fullUser.createdAt,
        });

        successCount++;
        logger.debug('migrate', `用户 ${user.id} 迁移成功`);
      } catch (error) {
        errorCount++;
        logger.error('migrate', `用户 ${user.id} 迁移失败`, error);
      }
    }

    logger.info('migrate', `用户数据迁移完成: 成功 ${successCount}, 失败 ${errorCount}`);
    return { successCount, errorCount };
  } catch (error) {
    logger.error('migrate', '迁移用户数据失败', error);
    throw error;
  }
}

/**
 * 迁移用户数据（文件夹、笔记、URL）
 */
async function migrateUserData() {
  logger.info('migrate', '开始迁移用户数据（文件夹、笔记、URL）...');
  
  try {
    const users = fileUserStore.getAllUsers();
    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // 从文件存储读取用户数据
        const userData = await fileUserDataStore.getUserData(user.id);
        
        // 迁移到数据库
        await dbUserDataDao.saveUserData(user.id, userData);
        
        successCount++;
        logger.debug('migrate', `用户 ${user.id} 的数据迁移成功`);
      } catch (error) {
        errorCount++;
        logger.error('migrate', `用户 ${user.id} 的数据迁移失败`, error);
      }
    }

    logger.info('migrate', `用户数据迁移完成: 成功 ${successCount}, 失败 ${errorCount}`);
    return { successCount, errorCount };
  } catch (error) {
    logger.error('migrate', '迁移用户数据失败', error);
    throw error;
  }
}

/**
 * 迁移消息数据
 */
async function migrateMessages() {
  logger.info('migrate', '开始迁移消息数据...');
  
  try {
    const users = fileUserStore.getAllUsers();
    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // 从文件存储读取用户消息
        const messages = fileMessageStore.getUserMessages(user.id);
        
        // 迁移到数据库
        for (const message of messages) {
          try {
            // 检查是否已存在
            const result = await query('SELECT id FROM messages WHERE id = $1', [message.id]);
            if (result.rows.length > 0) {
              continue;
            }

            await dbMessageDao.sendMessageToUser(user.id, message.title, message.content);
            
            // 如果消息已读，标记为已读
            if (message.isRead) {
              await dbMessageDao.markMessageAsRead(message.id);
            }
          } catch (error) {
            logger.warn('migrate', `消息 ${message.id} 迁移失败`, error);
          }
        }
        
        successCount++;
        logger.debug('migrate', `用户 ${user.id} 的消息迁移成功`);
      } catch (error) {
        errorCount++;
        logger.error('migrate', `用户 ${user.id} 的消息迁移失败`, error);
      }
    }

    logger.info('migrate', `消息数据迁移完成: 成功 ${successCount}, 失败 ${errorCount}`);
    return { successCount, errorCount };
  } catch (error) {
    logger.error('migrate', '迁移消息数据失败', error);
    throw error;
  }
}

/**
 * 迁移消息历史
 */
async function migrateMessageHistory() {
  logger.info('migrate', '开始迁移消息历史...');
  
  try {
    const history = fileMessageHistoryStore.getMessageHistory({ page: 1, limit: 10000 });
    let successCount = 0;
    let errorCount = 0;

    for (const record of history.history) {
      try {
        // 检查是否已存在
        const result = await query('SELECT id FROM message_history WHERE id = $1', [record.id]);
        if (result.rows.length > 0) {
          continue;
        }

        if (record.type === 'broadcast') {
          await dbMessageHistoryDao.addBroadcastHistory({
            title: record.title,
            content: record.content,
            userCount: record.userCount,
          });
        } else {
          await dbMessageHistoryDao.addMessageHistory({
            userId: record.userId,
            title: record.title,
            content: record.content,
            type: record.type,
          });
        }
        
        successCount++;
      } catch (error) {
        errorCount++;
        logger.warn('migrate', `历史记录 ${record.id} 迁移失败`, error);
      }
    }

    logger.info('migrate', `消息历史迁移完成: 成功 ${successCount}, 失败 ${errorCount}`);
    return { successCount, errorCount };
  } catch (error) {
    logger.error('migrate', '迁移消息历史失败', error);
    throw error;
  }
}

/**
 * 主迁移函数
 */
async function migrate() {
  try {
    logger.info('migrate', '开始数据迁移...');
    
    // 初始化数据库连接
    initPool();
    
    // 检查数据库是否已初始化
    const initialized = await isInitialized();
    if (!initialized) {
      logger.info('migrate', '数据库未初始化，开始创建schema...');
      await createSchema();
    } else {
      logger.info('migrate', '数据库已初始化');
    }
    
    // 执行迁移
    const results = {
      users: await migrateUsers(),
      userData: await migrateUserData(),
      messages: await migrateMessages(),
      messageHistory: await migrateMessageHistory(),
    };
    
    logger.info('migrate', '数据迁移完成', results);
    
    // 关闭连接
    await closePool();
    
    return results;
  } catch (error) {
    logger.error('migrate', '数据迁移失败', error);
    await closePool();
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrate()
    .then(() => {
      logger.info('migrate', '迁移脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('migrate', '迁移脚本执行失败', error);
      process.exit(1);
    });
}

module.exports = {
  migrate,
  migrateUsers,
  migrateUserData,
  migrateMessages,
  migrateMessageHistory,
};







