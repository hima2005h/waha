#!/bin/bash

# Try PORT first, then WHATSAPP_API_PORT, then default to 3000
PORT=${PORT:-${WHATSAPP_API_PORT:-3000}}

# Check if HTTPS is enabled
if [[ "${WAHA_HTTPS_ENABLED}" == "true" || "${WAHA_HTTPS_ENABLED}" == "1" ]]; then
  PROTOCOL="https"
else
  PROTOCOL="http"
fi

# Execute curl command with SSL verification disabled
curl -f -s -k "${PROTOCOL}://127.0.0.1:${PORT}/ping" || exit 1
