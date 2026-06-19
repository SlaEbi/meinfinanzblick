.PHONY: setup start update backup help

PROJECT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
BACKUP_DIR  := $(PROJECT_DIR)backups
DB_FILE     := $(PROJECT_DIR)data/finanzblick.db
DATE        := $(shell date +%F_%H%M)

help:
	@echo ""
	@echo "  MeinFinanzblick — Verfügbare Befehle"
	@echo "  ─────────────────────────────────────"
	@echo "  make setup    Ersteinrichtung (nur einmalig nötig)"
	@echo "  make start    App starten"
	@echo "  make update   Updates einspielen"
	@echo "  make backup   Datenbank sichern"
	@echo ""

setup:
	@bash $(PROJECT_DIR)scripts/setup.sh

start:
	@bash $(PROJECT_DIR)scripts/start.sh

update:
	@bash $(PROJECT_DIR)scripts/update.sh

backup:
	@mkdir -p $(BACKUP_DIR)
	@if [ -f "$(DB_FILE)" ]; then \
		cp "$(DB_FILE)" "$(BACKUP_DIR)/finanzblick_$(DATE).db" && \
		echo "✓  Backup gespeichert: backups/finanzblick_$(DATE).db"; \
	else \
		echo "⚠️  Keine Datenbank gefunden ($(DB_FILE))"; \
	fi
