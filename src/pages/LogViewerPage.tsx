import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { logger } from '../utils/logger';
import { useUserStore } from '../stores/userStore';
import './LogViewerPage.css';

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

interface LogStats {
  total: number;
  byLevel: {
    info: number;
    warn: number;
    error: number;
    debug: number;
  };
}

const LogViewerPage = () => {
  const navigate = useNavigate();
  const { token } = useUserStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>('');
  const logContainerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    if (!token) {
      setError('请先登录');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filterLevel) {
        params.append('level', filterLevel);
      }
      params.append('limit', '200');

      const response = await fetch(
        `${API_BASE_URL}/v1/data/logs?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 401) {
        setError('需要管理员权限');
        return;
      }

      if (!response.ok) {
        let errorData;
        try {
          const text = await response.text();
          errorData = text ? JSON.parse(text) : { message: '获取日志失败' };
        } catch {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.message || '获取日志失败');
      }

      const text = await response.text();
      if (!text) {
        throw new Error('服务器返回空响应');
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        logger.error('JSON解析失败:', e, '响应内容:', text);
        throw new Error('服务器返回格式错误');
      }
      if (data.success) {
        setLogs(data.data.logs || []);
        setStats(data.data.stats || null);
        
        // 自动滚动到底部
        setTimeout(() => {
          if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
          }
        }, 100);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取日志失败');
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!token) return;
    if (!confirm('确定要清空所有日志吗？')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/v1/data/logs`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setLogs([]);
        setStats(null);
      }
    } catch (err) {
      setError('清空日志失败');
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterLevel]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLogs();
    }, 2000); // 每2秒刷新一次

    return () => clearInterval(interval);
  }, [autoRefresh, filterLevel]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return '#ff4444';
      case 'warn':
        return '#ffaa00';
      case 'debug':
        return '#888888';
      default:
        return '#333333';
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="log-viewer-page">
      <div className="page-header">
        <button className="page-back-button" onClick={() => navigate(-1)}>
          返回
        </button>
        <h1 className="page-title">日志查看器</h1>
        <div className="header-actions">
          <button
            className={`auto-refresh-btn ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '⏸ 暂停' : '▶ 继续'}
          </button>
          <button className="refresh-btn" onClick={fetchLogs} disabled={loading}>
            🔄 刷新
          </button>
          <button className="clear-btn" onClick={clearLogs}>
            🗑 清空
          </button>
        </div>
      </div>

      {stats && (
        <div className="log-stats">
          <div className="stat-item">
            <span className="stat-label">总数:</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">信息:</span>
            <span className="stat-value" style={{ color: '#333' }}>{stats.byLevel.info}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">警告:</span>
            <span className="stat-value" style={{ color: '#ffaa00' }}>{stats.byLevel.warn}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">错误:</span>
            <span className="stat-value" style={{ color: '#ff4444' }}>{stats.byLevel.error}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">调试:</span>
            <span className="stat-value" style={{ color: '#888' }}>{stats.byLevel.debug}</span>
          </div>
        </div>
      )}

      <div className="log-filters">
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="level-filter"
        >
          <option value="">全部级别</option>
          <option value="info">信息</option>
          <option value="warn">警告</option>
          <option value="error">错误</option>
          <option value="debug">调试</option>
        </select>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="log-container" ref={logContainerRef}>
        {loading && logs.length === 0 ? (
          <div className="loading">加载中...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">暂无日志</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={`log-entry log-${log.level}`}>
              <div className="log-header">
                <span
                  className="log-level"
                  style={{ color: getLevelColor(log.level) }}
                >
                  [{log.level.toUpperCase()}]
                </span>
                <span className="log-time">{formatTime(log.timestamp)}</span>
              </div>
              <div className="log-message">
                <pre>{log.message}</pre>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogViewerPage;

