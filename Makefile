.PHONY: up-all down restart status logs

up-all:
	@echo "Levantando el contenedor Docker con persistencia a nivel de proyecto..."
	docker compose up -d --build
	@echo "Juego disponible en: http://localhost:8085"

down:
	@echo "Deteniendo y removiendo el contenedor Docker..."
	docker compose down

restart:
	@echo "Reiniciando el contenedor Docker..."
	docker compose restart

status:
	docker compose ps

logs:
	docker compose logs -f
