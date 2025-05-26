#!/bin/sh

# Calculate UV_THREADPOOL_SIZE based on number of CPUs
cpus=$(node -e "const os = require('os'); console.log(os.cpus().length);")
uv_threadpool_size=$(($cpus * 1))

# Set UV_THREADPOOL_SIZE as an environment variable
export UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-$uv_threadpool_size}"

# Start your application using node with exec to ensure proper signal handling
exec node dist/main
