#!/usr/bin/env bash

set -euo pipefail

echo "🔨 Building..."
npm run build

echo "🚀 Deploying..."
rsync -az --delete dist/ easybake:/var/www/easybake/

echo "✅ Deploy completed."