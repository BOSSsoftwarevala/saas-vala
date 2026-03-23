import argparse
import json
import os
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any, Iterable


def connect_db(db_file: str | os.PathLike[str]) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_file))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def load_existing_products(conn: sqlite3.Connection, table: str, id_column: str) -> set[Any]:
    with closing(conn.cursor()) as cursor:
        cursor.execute(f"SELECT {id_column} FROM {table}")
        return {row[0] for row in cursor.fetchall()}


def _iter_json_files(data_directory: str | os.PathLike[str]) -> Iterable[Path]:
    base = Path(data_directory)
    for p in sorted(base.glob("*.json")):
        if p.is_file():
            yield p


def _parse_products(payload: Any, file_name: str) -> list[dict[str, Any]]:
    if not isinstance(payload, list):
        raise ValueError(f"Expected a JSON array in {file_name}")
    out: list[dict[str, Any]] = []
    for item in payload:
        if isinstance(item, dict):
            out.append(item)
    return out


def migrate_products(
    conn: sqlite3.Connection,
    data_directory: str | os.PathLike[str],
    *,
    table: str = "products",
    id_column: str = "product_id",
    insert_columns: tuple[str, str, str] = ("product_id", "name", "price"),
    json_id_key: str = "id",
    json_name_key: str = "name",
    json_price_key: str = "price",
    dry_run: bool = False,
) -> int:
    existing_products = load_existing_products(conn, table, id_column)
    inserted = 0

    cols_sql = ", ".join(insert_columns)
    placeholders = ", ".join(["?"] * len(insert_columns))
    insert_sql = f"INSERT INTO {table} ({cols_sql}) VALUES ({placeholders})"

    with closing(conn.cursor()) as cursor:
        for file_path in _iter_json_files(data_directory):
            with file_path.open("r", encoding="utf-8") as f:
                payload = json.load(f)

            for product in _parse_products(payload, file_path.name):
                product_id = product.get(json_id_key)
                name = product.get(json_name_key)
                price = product.get(json_price_key)

                if product_id is None or name is None or price is None:
                    continue
                if product_id in existing_products:
                    continue

                if not dry_run:
                    cursor.execute(insert_sql, (product_id, name, price))

                existing_products.add(product_id)
                inserted += 1

    if not dry_run:
        conn.commit()

    return inserted


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate products from JSON files into a SQLite database.")
    parser.add_argument("--db", required=True, help="Path to SQLite database file.")
    parser.add_argument("--data", required=True, help="Directory containing JSON product files.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and count inserts without writing.")
    args = parser.parse_args()

    with closing(connect_db(Path(args.db))) as conn:
        migrate_products(conn, Path(args.data), dry_run=args.dry_run)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
