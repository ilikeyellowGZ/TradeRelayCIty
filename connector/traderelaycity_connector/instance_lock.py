from __future__ import annotations

import os
import msvcrt
from pathlib import Path

class InstanceAlreadyRunning(RuntimeError):
    pass

class SingleInstanceLock:
    def __init__(self, path: Path):
        self.path = path
        self.file = None

    def acquire(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.file = self.path.open("a+b")
        self.file.seek(0, os.SEEK_END)
        if self.file.tell() == 0:
            self.file.write(b"\0")
            self.file.flush()
        self.file.seek(0)
        try:
            msvcrt.locking(self.file.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError as error:
            self.file.close()
            self.file = None
            raise InstanceAlreadyRunning("TradeRelayCity Connector is already open for this Windows user.") from error

    def release(self) -> None:
        if self.file:
            self.file.seek(0)
            msvcrt.locking(self.file.fileno(), msvcrt.LK_UNLCK, 1)
            self.file.close()
            self.file = None
