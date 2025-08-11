#!/bin/bash

echo "Testing Divergent Mode API..."

# Test session creation
echo "Creating new divergent session..."
RESPONSE=$(curl -s -X POST http://localhost:5800/v1/pilot/divergent/session/new \
  -H "Content-Type: application/json" \
  -H "Cookie: _rf_uid=u-e17qw9i6d63hl3ztx8qgrv8y; _rf_access=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJ1LWUxN3F3OWk2ZDYzaGwzenR4OHFncnY4eSIsImVtYWlsIjoiYW50aGh1YmdnQGdtYWlsLmNvbSIsImlhdCI6MTc1NDY0Mzc0NywiZXhwIjoxNzU0NzMwMTQ3fQ.nijtt7SK0IIGRvX9Q6BoMrVlrn-wpaY1dW_Ym8m8C_k" \
  -d '{
    "prompt": "分析人工智能技术的发展前景",
    "maxDivergence": 3,
    "maxDepth": 2,
    "targetType": "canvas",
    "targetId": "c-nzew35yhkjvh959kn1hjj2kv"
  }')

echo "Response: $RESPONSE"

# Extract sessionId if available
SESSION_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('sessionId', 'unknown'))" 2>/dev/null || echo "failed")

echo "Session ID: $SESSION_ID"

if [ "$SESSION_ID" != "failed" ] && [ "$SESSION_ID" != "unknown" ]; then
  echo "Testing session status..."
  sleep 2
  curl -s "http://localhost:5800/v1/pilot/divergent/session/$SESSION_ID/status" \
    -H "Cookie: _rf_uid=u-e17qw9i6d63hl3ztx8qgrv8y; _rf_access=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJ1LWUxN3F3OWk2ZDYzaGwzenR4OHFncnY4eSIsImVtYWlsIjoiYW50aGh1YmdnQGdtYWlsLmNvbSIsImlhdCI6MTc1NDY0Mzc0NywiZXhwIjoxNzU0NzMwMTQ3fQ.nijtt7SK0IIGRvX9Q6BoMrVlrn-wpaY1dW_Ym8m8C_k"
  echo ""
fi

echo "Test completed."
