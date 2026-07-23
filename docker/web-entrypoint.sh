#!/bin/sh
set -eu

cat > /usr/share/nginx/html/canvio-config.js <<EOF
window.CANVIO_CONFIG = {
  apiUrl: "${VITE_API_URL:-}",
  wsUrl: "${VITE_WS_URL:-}"
};
EOF

exec nginx -g "daemon off;"
