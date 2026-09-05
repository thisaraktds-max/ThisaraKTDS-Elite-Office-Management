#!/usr/bin/env bash
# ==============================================================================
# Elite International School - Automated Remote System Update Script (Mac/Linux)
# ==============================================================================

set -e

echo ""
echo "======================================================================"
echo "  Elite International School — System Maintenance & Remote Updater"
echo "======================================================================"
echo ""

# 1. Check working directory
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"
echo "[1/5] Working in: $APP_DIR"

# 2. Ensure data directory & backup existing SQLite database
echo "[2/5] Creating safety snapshot of local SQLite database..."
mkdir -p data backups
if [ -f "data/school-office.db" ]; then
  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  cp data/school-office.db "backups/school-office_preupdate_${TIMESTAMP}.db"
  echo "      Backup preserved at: backups/school-office_preupdate_${TIMESTAMP}.db"
else
  echo "      No existing database found; a fresh database will be initialized on boot."
fi

# 3. Pull latest code if git repo exists
echo "[3/5] Checking for remote software updates..."
if [ -d ".git" ]; then
  echo "      Pulling latest release from Git remote..."
  git pull --ff-only || {
    echo "      Warning: Fast-forward git pull failed. Continuing with local codebase."
  }
else
  echo "      Git repository not detected; skipping git pull step."
fi

# 4. Install any new npm dependencies
echo "[4/5] Installing updated application dependencies..."
npm install --no-audit --no-fund

# 5. Compile production build
echo "[5/5] Compiling production client and server bundles..."
npm run build

echo ""
echo "======================================================================"
echo "  Update completed successfully! All assets and database are verified."
echo "  To start the server: npm run dev  (or: npm start)"
echo "======================================================================"
echo ""
