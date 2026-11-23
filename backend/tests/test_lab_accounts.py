"""Lab account SQL must be valid for every account host, including the '%' wildcard used in Docker.

Runs without MySQL: the admin calls of LabManager.reset_lab are captured and formatted exactly as
PyMySQL formats them (``query % escaped_args`` only when args are given).
"""
import pytest
from pymysql.converters import escape_item

from app.config import Settings
from app.sandbox.manager import LabManager


def _mogrify(sql: str, args) -> str:
    """What PyMySQL's Cursor.execute sends to the server."""
    if args is None:
        return sql
    return sql % tuple(escape_item(a, "utf8mb4") for a in args)


@pytest.mark.parametrize("host", ["%", "localhost", "10.0.%.%"])
def test_reset_lab_account_sql_for_any_host(tmp_path, monkeypatch, host):
    (tmp_path / "empty.sql").write_text("-- no tables\n")
    labs = LabManager(Settings(sandbox_account_host=host), tmp_path)
    sent: list[str] = []
    monkeypatch.setattr(labs, "admin", lambda sql, args=None, fetch=False: sent.append(_mogrify(sql, args)) or [])
    monkeypatch.setattr(labs, "_ensure_meta", lambda: None)

    info = labs.reset_lab("owner", "playground", "empty")

    account = f"'{info['schema']}'@'{host}'"
    create = next(q for q in sent if q.startswith("CREATE USER"))
    grant = next(q for q in sent if q.startswith("GRANT"))
    assert f"CREATE USER IF NOT EXISTS {account} IDENTIFIED BY " in create
    assert grant.endswith(f" TO {account}")
    assert not any("%%" in q for q in sent)
