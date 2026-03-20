# Docker Check

Verify all Docker services are running and healthy.

```bash
echo "=== Docker Compose Status ==="
docker compose ps

echo ""
echo "=== Service Health Checks ==="
for port in 8081 8082 8083 8085 8086 8087; do
  SVC=$(case $port in 8081) echo "dataaccess";; 8082) echo "intelligence";; 8083) echo "crm";; 8085) echo "correspondence";; 8086) echo "dataquality";; 8087) echo "knowledgebase";; esac)
  RESP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/healthz 2>/dev/null)
  if [ "$RESP" = "200" ]; then
    echo "✅ $SVC (:$port) — healthy"
  else
    echo "❌ $SVC (:$port) — HTTP $RESP"
  fi
done

echo ""
echo "=== Frontend ==="
RESP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
if [ "$RESP" = "200" ]; then
  echo "✅ frontend (:3000) — serving"
else
  echo "❌ frontend (:3000) — HTTP $RESP"
fi

echo ""
echo "=== PostgreSQL ==="
docker exec noui-postgres pg_isready 2>/dev/null && echo "✅ PostgreSQL — ready" || echo "❌ PostgreSQL — not ready"

echo ""
echo "=== Recent Logs (errors only) ==="
docker compose logs --tail=20 2>&1 | grep -iE "error|panic|fatal" | head -10 || echo "No errors in recent logs"
```

Report which services are healthy and which need attention.
