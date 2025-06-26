#!/bin/sh

#
# Run Xvfb if exists
#
if command -v Xvfb > /dev/null 2>&1; then
  # Start virtual X server in the background
  Xvfb :99 -screen 0 1280x720x24 &
  export DISPLAY=:99
  sleep 2
else
  echo "Xvfb command not found, skipping virtual X server setup"
fi

#
# Calculate UV_THREADPOOL_SIZE based on number of CPUs
#
cpus=$(node -e "const os = require('os'); console.log(os.cpus().length);")
uv_threadpool_size=$(($cpus * 1))

# Set UV_THREADPOOL_SIZE as an environment variable
export UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-$uv_threadpool_size}"

#
# Handle API key hashing
#
# Save WHATSAPP_API_KEY or WAHA_API_KEY in a variable (WHATSAPP_API_KEY has priority)
if [ -n "$WHATSAPP_API_KEY" ]; then
  key="$WHATSAPP_API_KEY"
elif [ -n "$WAHA_API_KEY" ]; then
  key="$WAHA_API_KEY"
fi

# Unset both environment variables
unset WHATSAPP_API_KEY
unset WAHA_API_KEY

# Process the key if it exists
if [ -n "$key" ]; then
  # Check if key is already hashed
  if echo "$key" | grep -q "^sha512:"; then
    # If already hashed, use it as is
    export WAHA_API_KEY="$key"
  else
    # Display warning about using plain text API key
    echo "⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️"
    echo "WARNING: Plain text API key detected. Converting to hashed format for security."
    echo "For better security, use WAHA_API_KEY=sha512:{SHA512_HASH_FOR_YOUR_API_KEY}"
    echo "⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️"
    # Hash the key using sha512sum
    HASHED_KEY=$(echo -n "$key" | sha512sum | awk '{print $1}')
    export WAHA_API_KEY="sha512:$HASHED_KEY"
  fi
fi

#
# Start your application using node with exec to ensure proper signal handling
#
exec node dist/main
