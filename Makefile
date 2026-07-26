# k6 stress test — make targets
#
#   make test    Run the stress test using .env settings.
#   make smoke   Start the bundled dummy API, run a short offline smoke test,
#                then stop the dummy API. Needs no internet and no real API.
#   make mock    Just run the dummy API in the foreground (Ctrl-C to stop).
#   make clean   Remove result/log files.

SHELL := /bin/bash
MOCK_HOST ?= 127.0.0.1
MOCK_PORT ?= 8799
MOCK_URL  := http://$(MOCK_HOST):$(MOCK_PORT)/health

.PHONY: test smoke mock clean

test:
	./run.sh

smoke:
	@echo ">> starting dummy API at $(MOCK_URL)"
	@MOCK_HOST=$(MOCK_HOST) MOCK_PORT=$(MOCK_PORT) python3 mock-server.py & echo $$! > .mock.pid
	@sleep 1
	@echo ">> running k6 smoke test (offline)"
	@API_URL=$(MOCK_URL) API_KEY=dummy-key AUTH_HEADER=x-api-key \
		MAX_VUS=5 RAMP_UP=2s SUSTAIN=4s RAMP_DOWN=1s SLEEP_SECONDS=0.2 \
		P95_MAX_MS=500 MAX_ERROR_RATE=0.01 \
		./run.sh; status=$$?; \
		kill `cat .mock.pid` 2>/dev/null; rm -f .mock.pid; \
		echo ">> dummy API stopped"; exit $$status

mock:
	MOCK_HOST=$(MOCK_HOST) MOCK_PORT=$(MOCK_PORT) python3 mock-server.py

clean:
	rm -f results.json *.log .mock.pid
