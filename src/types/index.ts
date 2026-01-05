// 文件夹类型
export type FolderType = 'normal' | 'privacy' | 'url';

// 文件夹颜色
export type FolderColor = 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple';

// 文件夹
export interface Folder {
  id: string;
  name: string;
  type: FolderType;
  color: FolderColor;
  icon?: string;
  isStarred: boolean;
  // 用于手动排序的权重，值越小越靠前
  order?: number;
  createdAt: number;
  updatedAt: number;
  password?: string; // 隐私文件夹密码
  // 软删除字段
  isDeleted: boolean;
  deletedAt: number | null;
  // 版本控制字段（用于并发冲突检测）
  version?: number; // 版本号，每次更新时递增
}

// 记事项
export interface Note {
  id: string;
  content: string;
  folderId?: string; // 如果为空，则在首页
  isStarred: boolean;
  createdAt: number;
  updatedAt: number;
  // 软删除字段
  isDeleted: boolean;
  deletedAt: number | null;
  // 版本控制字段（用于并发冲突检测）
  version?: number; // 版本号，每次更新时递增
}

// 网址项
export interface Url {
  id: string;
  title: string;
  url: string;
  folderId?: string;
  isStarred: boolean;
  createdAt: number;
  updatedAt: number;
  // 软删除字段
  isDeleted: boolean;
  deletedAt: number | null;
  // 版本控制字段（用于并发冲突检测）
  version?: number; // 版本号，每次更新时递增
}

// 回收站项
export interface TrashItem {
  id: string;
  type: 'note' | 'url' | 'folder';
  data: Note | Url | Folder;
  deletedAt: number;
}

// 用户
export interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string; // 头像 base64 或 URL
  createdAt: number;
}

// 消息
export interface Message {
  id: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: number;
}


