"""Windows Credential Manager wrapper. There is deliberately no plaintext fallback."""
from __future__ import annotations

import ctypes
from ctypes import wintypes

class CredentialStoreError(RuntimeError):
    pass

class CREDENTIAL(ctypes.Structure):
    _fields_ = [
        ("Flags", wintypes.DWORD), ("Type", wintypes.DWORD), ("TargetName", wintypes.LPWSTR),
        ("Comment", wintypes.LPWSTR), ("LastWritten", wintypes.FILETIME), ("CredentialBlobSize", wintypes.DWORD),
        ("CredentialBlob", ctypes.POINTER(ctypes.c_byte)), ("Persist", wintypes.DWORD),
        ("AttributeCount", wintypes.DWORD), ("Attributes", ctypes.c_void_p),
        ("TargetAlias", wintypes.LPWSTR), ("UserName", wintypes.LPWSTR),
    ]

def _api():
    if __import__("sys").platform != "win32":
        raise CredentialStoreError("Windows Credential Manager is only available on Windows.")
    return ctypes.windll.advapi32, ctypes.windll.kernel32

def store_secret(target: str, secret: str) -> None:
    advapi32, _ = _api()
    blob = secret.encode("utf-16-le")
    buffer = (ctypes.c_byte * len(blob)).from_buffer_copy(blob)
    credential = CREDENTIAL(0, 1, target, None, wintypes.FILETIME(), len(blob), buffer, 2, 0, None, None, "TradeRelayCity")
    if not advapi32.CredWriteW(ctypes.byref(credential), 0):
        raise CredentialStoreError(f"Credential Manager write failed (Windows error {ctypes.get_last_error()}).")

def read_secret(target: str) -> str | None:
    advapi32, _ = _api()
    pointer = ctypes.POINTER(CREDENTIAL)()
    if not advapi32.CredReadW(target, 1, 0, ctypes.byref(pointer)):
        code = ctypes.get_last_error()
        if code == 1168:
            return None
        raise CredentialStoreError(f"Credential Manager read failed (Windows error {code}).")
    try:
        cred = pointer.contents
        raw = ctypes.string_at(cred.CredentialBlob, cred.CredentialBlobSize)
        return raw.decode("utf-16-le")
    finally:
        advapi32.CredFree(pointer)

def delete_secret(target: str) -> None:
    advapi32, _ = _api()
    if not advapi32.CredDeleteW(target, 1, 0):
        code = ctypes.get_last_error()
        if code != 1168:
            raise CredentialStoreError(f"Credential Manager delete failed (Windows error {code}).")
