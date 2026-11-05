#!/usr/bin/env bash
# Verifica un respaldo ya restaurado (RNF-09, ADR 0027). Lo usan el workflow respaldo.yml y el
# runbook docs/runbooks/restore.md.
#
#   RESTAURADA_URL=postgresql://... verificar-respaldo.sh <schema.prisma> <carpeta de migraciones>
#
# Comprueba que estén todas las tablas del esquema, que las migraciones aplicadas coincidan con las
# del repositorio, que haya al menos un comercio, que la RLS siga forzada y, si existe app_api, que
# tenga los permisos de las migraciones (permisos-app-api.sh). Escribe cantidades y tamaños en
# $GITHUB_STEP_SUMMARY (o en la salida estándar), nunca filas: el resumen no lleva datos personales.
set -euo pipefail

esquema="${1:?falta la ruta a schema.prisma}"
migraciones="${2:?falta la carpeta de migraciones}"
: "${RESTAURADA_URL:?falta RESTAURADA_URL}"
resumen="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
fallas=0

consultar() {
  psql "$RESTAURADA_URL" -X -q -t -A -v ON_ERROR_STOP=1 -c "$1" | tr -d '\r'
}

fallar() {
  echo "::error::$1"
  fallas=$((fallas + 1))
}

# Tablas que espera el repositorio: cada model de schema.prisma, con el nombre de su @@map.
esperadas=$(awk '
  /^model [A-Za-z0-9_]+ \{/ { modelo = $2; tabla = $2; next }
  modelo != "" && /@@map\("/ { tabla = $0; sub(/.*@@map\("/, "", tabla); sub(/".*/, "", tabla) }
  modelo != "" && /^\}/ { print tabla; modelo = "" }
' "$esquema" | sort)

restauradas=$(consultar "SELECT tablename FROM pg_tables
  WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY 1" | sort)

faltantes=$(comm -23 <(echo "$esperadas") <(echo "$restauradas"))
sobrantes=$(comm -13 <(echo "$esperadas") <(echo "$restauradas"))
if [ -n "$faltantes" ]; then
  fallar "Faltan tablas en el respaldo: $(echo "$faltantes" | paste -sd ' ')"
fi
if [ -n "$sobrantes" ]; then
  echo "::warning::El respaldo tiene tablas que el esquema no declara: $(echo "$sobrantes" | paste -sd ' ')"
fi

# Migraciones: las carpetas del repositorio contra las filas terminadas de _prisma_migrations.
en_repo=$(find "$migraciones" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort)
aplicadas=$(consultar "SELECT migration_name FROM _prisma_migrations
  WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY 1" | sort)

pendientes=$(comm -23 <(echo "$en_repo") <(echo "$aplicadas"))
desconocidas=$(comm -13 <(echo "$en_repo") <(echo "$aplicadas"))
if [ -n "$pendientes" ]; then
  fallar "Migraciones del repositorio que producción no tiene aplicadas: $(echo "$pendientes" | paste -sd ' ')"
fi
if [ -n "$desconocidas" ]; then
  fallar "Migraciones aplicadas en producción que el repositorio no tiene: $(echo "$desconocidas" | paste -sd ' ')"
fi

comercios=$(consultar "SELECT count(*) FROM comercio" 2>/dev/null || echo 0)
if [ "$comercios" -lt 1 ]; then
  fallar "El respaldo no tiene ningún comercio"
fi

# RLS: toda tabla del esquema vuelve con la seguridad por fila activa y forzada (RNF-10).
sin_rls=$(consultar "SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_prisma_migrations'
    AND NOT (c.relrowsecurity AND c.relforcerowsecurity) ORDER BY 1")
if [ -n "$sin_rls" ]; then
  fallar "Tablas sin RLS forzada después de restaurar: $(echo "$sin_rls" | paste -sd ' ')"
fi
politicas=$(consultar "SELECT count(*) FROM pg_policies WHERE schemaname = 'public'")

# Permisos de app_api, si el rol existe (permisos-app-api.sh ya corrió): lee todas las tablas, no
# toca _prisma_migrations y no tiene lo que cada migración le revoca.
permisos="sin comprobar (no existe app_api)"
if [ "$(consultar "SELECT count(*) FROM pg_roles WHERE rolname = 'app_api'")" = "1" ]; then
  esperados=0
  for tabla in $esperadas; do
    esperados=$((esperados + 1))
    if [ "$(consultar "SELECT has_table_privilege('app_api', 'public.\"$tabla\"', 'SELECT')")" != "t" ]; then
      fallar "app_api no puede leer $tabla"
    fi
  done
  if [ "$(consultar "SELECT has_table_privilege('app_api', 'public._prisma_migrations', 'SELECT')")" != "f" ]; then
    fallar "app_api puede leer _prisma_migrations"
  fi
  while read -r tabla privilegios; do
    for privilegio in ${privilegios//,/ }; do
      esperados=$((esperados + 1))
      if [ "$(consultar "SELECT has_table_privilege('app_api', 'public.\"$tabla\"', '$privilegio')")" != "f" ]; then
        fallar "app_api conserva $privilegio sobre $tabla"
      fi
    done
  done < <(cat "$migraciones"/*/migration.sql | tr -d '\r' \
    | sed -nE 's/^REVOKE ([A-Z, ]+) ON "([a-z_]+)" FROM app_api;$/\2 \1/p')
  permisos="$esperados comprobados"
fi

{
  echo "### Verificación del respaldo"
  echo
  echo "| Comprobación | Resultado |"
  echo "|---|---|"
  echo "| Tablas del esquema | $(echo "$restauradas" | grep -c . || true) de $(echo "$esperadas" | grep -c .) |"
  echo "| Migraciones aplicadas | $(echo "$aplicadas" | grep -c . || true) de $(echo "$en_repo" | grep -c .) en el repositorio |"
  echo "| Comercios | $comercios |"
  echo "| RLS forzada | $([ -z "$sin_rls" ] && echo "en todas las tablas" || echo "faltan: $(echo "$sin_rls" | paste -sd ' ')"), $politicas políticas |"
  echo "| Permisos de \`app_api\` | $permisos |"
  echo
  echo "| Tabla | Filas | Tamaño |"
  echo "|---|---:|---:|"
  for tabla in $restauradas; do
    filas=$(consultar "SELECT count(*) FROM \"$tabla\"")
    tamanio=$(consultar "SELECT pg_size_pretty(pg_total_relation_size('public.\"$tabla\"'))")
    echo "| \`$tabla\` | $filas | $tamanio |"
  done
  echo
  if [ "$fallas" -eq 0 ]; then
    echo "Resultado: **el respaldo se restauró y pasó todas las comprobaciones.**"
  else
    echo "Resultado: **comprobaciones fallidas: $fallas** (ver los errores del paso)."
  fi
} >>"$resumen"

[ "$fallas" -eq 0 ]
