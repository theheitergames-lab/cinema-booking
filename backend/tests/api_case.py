"""Интеграционные проверки HTTP API в отдельной временной схеме PostgreSQL."""
import json
import os
from pathlib import Path
import socket
import threading
import time
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener
from uuid import uuid4

from psycopg import sql
import uvicorn

from app.db import get_connection
from app.main import app


DOCS = Path(__file__).resolve().parents[2] / "docs"


class ApiCase(unittest.TestCase):
    db = staticmethod(get_connection)

    @classmethod
    def setUpClass(cls):
        schema_name = "cinema_test_" + uuid4().hex
        schema = sql.Identifier(schema_name)
        with get_connection() as conn:
            conn.execute(sql.SQL("CREATE SCHEMA {}").format(schema))

        def drop_test_schema():
            with get_connection() as conn:
                conn.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(schema))

        cls.addClassCleanup(drop_test_schema)
        env = patch.dict(os.environ, {"PGOPTIONS": "-c search_path=" + schema_name})
        env.start()
        cls.addClassCleanup(env.stop)
        with get_connection() as conn:
            # Деструктивные учебные скрипты выполняются только в нашей схеме.
            if conn.execute("SELECT current_schema() AS name").fetchone()["name"] != schema_name:
                raise RuntimeError("Не удалось выбрать временную схему тестов")
            for filename in ("cinema_schema.sql", "seed.sql"):
                conn.execute((DOCS / filename).read_text(encoding="utf-8"))
            cls.tomorrow = conn.execute("SELECT current_date + 1 AS day").fetchone()["day"]

        listener = socket.socket()
        cls.addClassCleanup(listener.close)
        listener.bind(("127.0.0.1", 0))
        cls.url = f"http://127.0.0.1:{listener.getsockname()[1]}"
        server = uvicorn.Server(uvicorn.Config(app, log_level="error"))
        thread = threading.Thread(target=server.run, kwargs={"sockets": [listener]}, daemon=True)
        thread.start()

        def stop_server():
            server.should_exit = True
            thread.join(timeout=10)

        cls.addClassCleanup(stop_server)
        deadline = time.monotonic() + 10
        while not server.started:
            if not thread.is_alive() or time.monotonic() >= deadline:
                raise RuntimeError("Тестовый сервер не запустился")
            time.sleep(0.02)

        cls.admin = cls.login("admin@cinema.local", "admin123")
        cls.viewer = cls.login("ivan@example.com", "ivan123")

    @classmethod
    def request(cls, method, path, data=None, token=None):
        body = json.dumps(data).encode() if data is not None else None
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = "Bearer " + token
        request = Request(cls.url + path, body, headers, method=method)
        try:
            response = build_opener(ProxyHandler({})).open(request, timeout=15)
        except HTTPError as exc:
            response = exc
        with response:
            content = response.read()
            return response.status, json.loads(content) if content else None

    @classmethod
    def login(cls, email, password):
        status, data = cls.request("POST", "/auth/login", {"email": email, "password": password})
        if status != 200:
            raise AssertionError(f"Вход тестового пользователя завершился с HTTP {status}")
        return data["access_token"]

    def api(self, method, path, data=None, token=None, expected=200):
        status, payload = self.request(method, path, data, token)
        self.assertEqual(status, expected, f"{method} {path}: {payload}")
        return payload
