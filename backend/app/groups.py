"""Grupos de amigos para competir en retos (ver challenges.py)."""
import secrets
import string
import time

from .database import get_conn

_CODE_ALPHABET = string.ascii_uppercase + string.digits
_CODE_LEN = 6


def _public_user(row: dict) -> dict:
    return {"id": row["id"], "name": row["name"], "color": row["color"], "isBot": bool(row["is_bot"])}


def _generate_code(conn) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LEN))
        if not conn.execute("SELECT 1 FROM groups WHERE code = ?", (code,)).fetchone():
            return code
    raise RuntimeError("No se pudo generar un código de grupo único")


def create_group(owner_id: int, name: str) -> dict:
    name = (name or "").strip()
    if not name or len(name) > 40:
        raise ValueError("El nombre del grupo debe tener entre 1 y 40 caracteres")
    now = time.time()
    with get_conn() as conn:
        code = _generate_code(conn)
        cur = conn.execute(
            "INSERT INTO groups (name, code, owner_id, created_at) VALUES (?, ?, ?, ?)",
            (name, code, owner_id, now),
        )
        group_id = cur.lastrowid
        conn.execute(
            "INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)",
            (group_id, owner_id, now),
        )
        return dict(conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone())


def join_group(user_id: int, code: str) -> dict:
    code = (code or "").strip().upper()
    with get_conn() as conn:
        group = conn.execute("SELECT * FROM groups WHERE code = ?", (code,)).fetchone()
        if not group:
            raise ValueError("Código de grupo no válido")
        group = dict(group)
        already = conn.execute(
            "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
            (group["id"], user_id),
        ).fetchone()
        if not already:
            conn.execute(
                "INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)",
                (group["id"], user_id, time.time()),
            )
        return group


def is_member(group_id: int, user_id: int) -> bool:
    with get_conn() as conn:
        return (
            conn.execute(
                "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
                (group_id, user_id),
            ).fetchone()
            is not None
        )


def get_group(group_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()
        return dict(row) if row else None


def list_members(group_id: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT u.* FROM group_members gm
               JOIN users u ON u.id = gm.user_id
               WHERE gm.group_id = ? ORDER BY gm.joined_at""",
            (group_id,),
        ).fetchall()
        return [_public_user(dict(r)) for r in rows]


def list_my_groups(user_id: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT g.* FROM groups g
               JOIN group_members gm ON gm.group_id = g.id
               WHERE gm.user_id = ? ORDER BY g.created_at DESC""",
            (user_id,),
        ).fetchall()
        out = []
        for r in rows:
            g = dict(r)
            count = conn.execute(
                "SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?", (g["id"],)
            ).fetchone()["c"]
            g["memberCount"] = count
            out.append(g)
        return out
