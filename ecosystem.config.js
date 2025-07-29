module.exports = {
    apps: [
        {
            name: 'funding-rate-trader',
            script: 'src/strategy/funding-rate-trader/trader-test.ts',
            interpreter: 'node',
            interpreter_args: '--loader ts-node/esm',
            args: 'start',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production',
                TS_NODE_PROJECT: './tsconfig.json'
            },
            // Restart policy
            restart_delay: 5000, // Wait 5 seconds before restart
            max_restarts: 10, // Max 10 restarts per hour
            min_uptime: '30s', // Must run for 30s to be considered stable

            // Logging
            log_file: './logs/funding-trader-combined.log',
            out_file: './logs/funding-trader-out.log',
            error_file: './logs/funding-trader-error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,

            // Process management
            kill_timeout: 10000, // 10 seconds to gracefully shutdown
            listen_timeout: 10000,

            // Health monitoring
            health_check_grace_period: 30000, // 30 seconds grace period

            // Crash recovery settings
            exp_backoff_restart_delay: 100, // Exponential backoff for restarts

            // Custom restart conditions
            node_args: '--max-old-space-size=512'
        },
        {
            name: 'settlement-monitor',
            script: 'src/examples/settlement-monitor-example.ts',
            interpreter: 'node',
            interpreter_args: '--loader ts-node/esm',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '300M',
            env: {
                NODE_ENV: 'production',
                TS_NODE_PROJECT: './tsconfig.json'
            },
            // Restart policy
            restart_delay: 3000,
            max_restarts: 15,
            min_uptime: '20s',

            // Logging
            log_file: './logs/settlement-monitor-combined.log',
            out_file: './logs/settlement-monitor-out.log',
            error_file: './logs/settlement-monitor-error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,

            // Process management
            kill_timeout: 8000,
            listen_timeout: 8000,

            // Health monitoring
            health_check_grace_period: 20000,

            node_args: '--max-old-space-size=256'
        }
    ],

    // Deployment configuration (optional)
    deploy: {
        production: {
            user: 'node',
            host: 'localhost',
            ref: 'origin/main',
            repo: 'git@github.com:repo.git',
            path: '/var/www/production',
            'pre-deploy-local': '',
            'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
            'pre-setup': ''
        }
    }
};
