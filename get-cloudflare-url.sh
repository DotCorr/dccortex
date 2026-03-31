#!/bin/bash
# Check Cloudflare Tunnel status. For dccortex.com you use a named tunnel (credentials in ~/.cloudflared/).

echo "🔍 Cloudflare Tunnel status"
echo ""

if ! docker ps | grep -q cloudflare-tunnel; then
  echo "❌ Tunnel container not running. Start stack: ./start-dev.sh"
  exit 1
fi

echo "📋 Last 20 lines of tunnel logs:"
echo ""
docker-compose -f docker-compose.dev.yml logs cloudflare-tunnel --tail 20 2>/dev/null || true
echo ""

if docker-compose -f docker-compose.dev.yml logs cloudflare-tunnel 2>/dev/null | grep -q "Registered tunnel connection\|Connection.*registered"; then
  echo "✅ Tunnel is connected. Your domain (dccortex.com / api.dccortex.com) should work if DNS points to the tunnel."
else
  echo "⚠️  Tunnel may not be connected. If you see credential errors:"
  echo "   - Put your tunnel credentials at ~/.cloudflared/credentials.json"
  echo "   - Get them from Cloudflare Dashboard → Zero Trust → Tunnels → your tunnel"
  echo "   - Then: docker-compose -f docker-compose.dev.yml restart cloudflare-tunnel"
fi
echo ""

