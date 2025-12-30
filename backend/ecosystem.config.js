module.exports = {
  apps: [{
    name: 'piccco-backend',
    script: 'src/server.js',
    cwd: '/www/wwwroot/piccco3/backend',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    error_file: '/www/wwwroot/piccco3/backend/logs/error.log',
    out_file: '/www/wwwroot/piccco3/backend/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '500M',
    watch: false
  }]
};


