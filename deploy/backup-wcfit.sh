#!/usr/bin/env bash
set -euo pipefail
umask 077

destino=${1:?Uso: bash deploy/backup-wcfit.sh DIRETORIO_PRIVADO [CONTAINER_POSTGRES]}
container=${2:-wcfit-postgres}
backup=$(mktemp -d "$destino/wcfit-$(date -u +%Y%m%dT%H%M%SZ).XXXXXXXX")
docker exec "$container" sh -ec 'exec pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$backup/wcfit.dump.partial"
docker exec -i "$container" pg_restore --list < "$backup/wcfit.dump.partial" > /dev/null
mv "$backup/wcfit.dump.partial" "$backup/wcfit.dump"
(cd "$backup" && sha256sum wcfit.dump > wcfit.dump.sha256 && sha256sum -c wcfit.dump.sha256)
printf 'Backup verificado: %s\n' "$backup"
