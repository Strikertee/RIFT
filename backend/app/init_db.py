from __future__ import annotations

from .db import create_schema


def main() -> None:
    create_schema()
    print("Schema ready.")


if __name__ == "__main__":
    main()
