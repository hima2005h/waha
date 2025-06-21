#!/bin/sh

# Check if Xvfb command exists
if command -v Xvfb > /dev/null 2>&1; then
  # Start virtual X server in the background
  Xvfb :99 -screen 0 1280x720x24 &
  export DISPLAY=:99
  sleep 2
else
  echo "Xvfb command not found, skipping virtual X server setup"
fi

# Calculate UV_THREADPOOL_SIZE based on number of CPUs
cpus=$(node -e "const os = require('os'); console.log(os.cpus().length);")
uv_threadpool_size=$(($cpus * 1))

# Set UV_THREADPOOL_SIZE as an environment variable
export UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-$uv_threadpool_size}"

# Start your application using node with exec to ensure proper signal handling
exec node dist/main
