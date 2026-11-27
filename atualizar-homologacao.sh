#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$(realpath "$0")")"

compose=(
  docker compose
  --env-file .env.homologacao.servidor.local
  -f deploy/docker-compose.homologacao.yml
)

case "${1:-todos}" in
  frontend) servicos=(frontend) ;;
  backend) servicos=(backend) ;;
  todos) servicos=(backend frontend) ;;
  *) echo "Uso: $0 [frontend|backend|todos]"; exit 1 ;;
esac

"${compose[@]}" config --quiet
"${compose[@]}" build "${servicos[@]}"
"${compose[@]}" up -d --no-deps --no-build "${servicos[@]}"
"${compose[@]}" ps

curl -fsS --retry 10 --retry-delay 2 --retry-all-errors \
  http://127.0.0.1:8080/api/health

echo
echo "Homologacao atualizada com sucesso."
