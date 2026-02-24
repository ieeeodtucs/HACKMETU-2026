"""
HTTP exception helpers.
"""

from fastapi import HTTPException


def http_400(detail: str) -> HTTPException:
    return HTTPException(status_code=400, detail=detail)


def http_401(detail: str = "Invalid credentials") -> HTTPException:
    return HTTPException(status_code=401, detail=detail)


def http_403(detail: str = "Device not registered") -> HTTPException:
    return HTTPException(status_code=403, detail=detail)


def http_404(detail: str = "Not found") -> HTTPException:
    return HTTPException(status_code=404, detail=detail)


def http_500(detail: str = "Internal error") -> HTTPException:
    return HTTPException(status_code=500, detail=detail)
