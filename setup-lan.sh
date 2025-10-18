#!/bin/bash

# NSC - Network Setup Helper Script
# This script helps configure the application for LAN access

echo "🌐 NSC LAN Setup Helper"
echo "======================="
echo ""

# Detect local IP address
echo "🔍 Detecting your local IP address..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    LOCAL_IP=$(hostname -I | awk '{print $1}')
else
    echo "⚠️  OS not detected. Please enter your IP manually."
    LOCAL_IP=""
fi

if [ -z "$LOCAL_IP" ]; then
    echo "⚠️  Could not auto-detect IP address."
    read -p "Enter your machine's LAN IP address (e.g., 192.168.1.100): " LOCAL_IP
else
    echo "✅ Detected IP: $LOCAL_IP"
    read -p "Is this correct? (y/n): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        read -p "Enter your machine's LAN IP address: " LOCAL_IP
    fi
fi

echo ""
echo "📝 Configuring .env.docker with IP: $LOCAL_IP"
echo ""

# Backup existing .env.docker
if [ -f .env.docker ]; then
    cp .env.docker .env.docker.backup
    echo "✅ Backed up existing .env.docker to .env.docker.backup"
fi

# Update .env.docker
sed -i.tmp "s|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=http://${LOCAL_IP}:8001|g" .env.docker
sed -i.tmp "s|VITE_MQTT_WS_URL=.*|VITE_MQTT_WS_URL=ws://${LOCAL_IP}:9001|g" .env.docker
rm -f .env.docker.tmp

echo "✅ Updated .env.docker with:"
echo "   - VITE_API_BASE_URL=http://${LOCAL_IP}:8001"
echo "   - VITE_MQTT_WS_URL=ws://${LOCAL_IP}:9001"
echo ""

# Display access URLs
echo "🚀 Access URLs after Docker build:"
echo "   - Frontend: http://${LOCAL_IP}:8002"
echo "   - Backend API: http://${LOCAL_IP}:8001"
echo "   - MQTT WebSocket: ws://${LOCAL_IP}:9001"
echo ""

# Ask if user wants to build now
read -p "Build and start Docker containers now? (y/n): " build_now

if [ "$build_now" = "y" ] || [ "$build_now" = "Y" ]; then
    echo ""
    echo "🔨 Building and starting Docker containers..."
    echo "This may take a few minutes..."
    echo ""
    docker compose --env-file .env.docker down
    docker compose --env-file .env.docker up -d --build
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Docker containers started successfully!"
        echo ""
        echo "📱 Share these URLs with other devices on your network:"
        echo "   Frontend: http://${LOCAL_IP}:8002"
        echo "   Backend: http://${LOCAL_IP}:8001"
        echo ""
        echo "🎮 Unity VR Configuration:"
        echo "   Set backendUrl = \"http://${LOCAL_IP}:8001\""
        echo ""
        echo "📊 Check status: docker compose --env-file .env.docker ps"
        echo "📋 View logs: docker compose --env-file .env.docker logs -f"
    else
        echo ""
        echo "❌ Docker build failed. Check the error messages above."
        echo "   View logs: docker compose --env-file .env.docker logs"
    fi
else
    echo ""
    echo "⏸️  Skipping Docker build."
    echo "   To build manually, run:"
    echo "   docker compose --env-file .env.docker up -d --build"
fi

echo ""
echo "📚 For more details, see NETWORK_SETUP.md"
echo ""
