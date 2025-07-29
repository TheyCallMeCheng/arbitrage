#!/bin/bash

# Funding Rate Trader - Production Startup Script
# This script sets up and starts the trading system in production

set -e  # Exit on any error

echo "🚀 Starting Funding Rate Trader Production Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

print_success "Node.js version check passed: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
    print_success "Dependencies installed"
else
    print_status "Dependencies already installed"
fi

# Check if PM2 is installed globally, if not install it locally
if ! command -v pm2 &> /dev/null; then
    print_warning "PM2 not found globally. Using local PM2..."
    if [ ! -f "node_modules/.bin/pm2" ]; then
        print_status "Installing PM2 locally..."
        npm install pm2 --save-dev
    fi
    PM2_CMD="npx pm2"
else
    PM2_CMD="pm2"
    print_success "PM2 found: $(pm2 -v)"
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    print_status "Please create a .env file with your Bybit API credentials:"
    echo ""
    echo "BYBIT_API_KEY=your_api_key_here"
    echo "BYBIT_SECRET=your_secret_here"
    echo ""
    exit 1
fi

# Validate .env file has required variables
if ! grep -q "BYBIT_API_KEY=" .env || ! grep -q "BYBIT_SECRET=" .env; then
    print_error ".env file is missing required variables!"
    print_status "Please ensure your .env file contains:"
    echo "BYBIT_API_KEY=your_api_key_here"
    echo "BYBIT_SECRET=your_secret_here"
    exit 1
fi

print_success ".env file found and validated"

# Create logs directory if it doesn't exist
if [ ! -d "logs" ]; then
    print_status "Creating logs directory..."
    mkdir -p logs
    print_success "Logs directory created"
fi

# Create data directory if it doesn't exist
if [ ! -d "data" ]; then
    print_status "Creating data directory..."
    mkdir -p data
    print_success "Data directory created"
fi

# Build TypeScript if needed
if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
    print_status "Building TypeScript..."
    npm run build
    print_success "TypeScript build completed"
fi

# Stop any existing PM2 processes
print_status "Stopping any existing processes..."
$PM2_CMD stop ecosystem.config.js 2>/dev/null || true
$PM2_CMD delete ecosystem.config.js 2>/dev/null || true

# Start the processes
print_status "Starting processes with PM2..."
$PM2_CMD start ecosystem.config.js

# Wait a moment for processes to start
sleep 3

# Check process status
print_status "Checking process status..."
$PM2_CMD status

# Show logs for a few seconds
print_status "Showing initial logs (press Ctrl+C to stop)..."
echo ""
print_warning "The system is now running. Use the following commands to manage it:"
echo ""
echo "  npm run pm2:status    - Check process status"
echo "  npm run pm2:logs      - View all logs"
echo "  npm run pm2:monit     - Real-time monitoring"
echo "  npm run pm2:stop      - Stop all processes"
echo "  npm run pm2:restart   - Restart all processes"
echo ""
print_success "Production startup completed!"
echo ""

# Optionally show logs
read -p "Would you like to view live logs now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Showing live logs (press Ctrl+C to exit)..."
    $PM2_CMD logs
fi
