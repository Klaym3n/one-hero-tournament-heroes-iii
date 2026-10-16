#!/bin/sh
# Zgodne z Pterodactylem: Wings przekazuje komendę startową w zmiennej STARTUP ({{ZMIENNA}} → ${ZMIENNA}).
set -e
if [ -d /home/container ] && [ -w /home/container ]; then cd /home/container; fi
if [ -n "${STARTUP}" ]; then
  MODIFIED_STARTUP=$(echo "${STARTUP}" | sed -e 's/{{/${/g' -e 's/}}/}/g')
  echo ":/home/container$ ${MODIFIED_STARTUP}"
  eval exec "${MODIFIED_STARTUP}"
fi
exec /app/start.sh
