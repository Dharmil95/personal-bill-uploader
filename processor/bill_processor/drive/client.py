"""Google Drive client: OAuth refresh, list, download."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from bill_processor import config


@dataclass(frozen=True)
class DriveFile:
    drive_file_id: str
    filename: str
    owner: str
    category: str
    mime_type: str | None
    web_view_link: str | None
    drive_created_at: datetime | None


def _escape_drive_query_value(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


class DriveClient:
    def __init__(self) -> None:
        config.require_google_config()
        self._access_token: str | None = None

    def _refresh_access_token(self) -> str:
        body = urllib.parse.urlencode(
            {
                "client_id": config.GOOGLE_CLIENT_ID,
                "client_secret": config.GOOGLE_CLIENT_SECRET,
                "refresh_token": config.GOOGLE_REFRESH_TOKEN,
                "grant_type": "refresh_token",
            }
        ).encode()
        req = urllib.request.Request(
            "https://oauth2.googleapis.com/token",
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
        except urllib.error.HTTPError as exc:
            details = exc.read().decode(errors="replace")
            raise RuntimeError(f"Failed to refresh Google access token: {details}") from exc

        token = data.get("access_token")
        if not token:
            raise RuntimeError("Google token response did not include access_token")
        self._access_token = token
        return token

    @property
    def access_token(self) -> str:
        if not self._access_token:
            return self._refresh_access_token()
        return self._access_token

    def _drive_request(
        self,
        path: str,
        *,
        method: str = "GET",
        body: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> bytes:
        url = f"https://www.googleapis.com/drive/v3/{path}"
        req_headers = {"Authorization": f"Bearer {self.access_token}"}
        if headers:
            req_headers.update(headers)
        req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                if resp.status == 204:
                    return b""
                return resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code == 401:
                self._access_token = None
                req_headers["Authorization"] = f"Bearer {self.access_token}"
                req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
                with urllib.request.urlopen(req, timeout=120) as resp:
                    return resp.read() if resp.status != 204 else b""
            details = exc.read().decode(errors="replace")
            raise RuntimeError(f"Google Drive request failed: {details}") from exc

    @staticmethod
    def _parse_owner(app_properties: dict[str, str] | None) -> str:
        owner = (app_properties or {}).get("owner", "me")
        return owner if owner in config.VALID_OWNERS else "me"

    @staticmethod
    def _parse_category(app_properties: dict[str, str] | None) -> str:
        return (app_properties or {}).get("category", "Misc")

    @staticmethod
    def _parse_drive_file(raw: dict[str, Any]) -> DriveFile:
        app_props = raw.get("appProperties") or {}
        created_raw = raw.get("createdTime")
        drive_created_at = None
        if created_raw:
            drive_created_at = datetime.fromisoformat(created_raw.replace("Z", "+00:00"))

        return DriveFile(
            drive_file_id=raw["id"],
            filename=raw.get("name") or "unknown",
            owner=DriveClient._parse_owner(app_props),
            category=DriveClient._parse_category(app_props),
            mime_type=raw.get("mimeType"),
            web_view_link=raw.get("webViewLink"),
            drive_created_at=drive_created_at,
        )

    def list_bill_files(
        self,
        *,
        owner: str | None = None,
        category: str | None = None,
        page_size: int = 100,
    ) -> list[DriveFile]:
        query_parts = [
            f"appProperties has {{ key='source' and value='{config.DRIVE_APP_SOURCE}' }}",
            "mimeType != 'application/vnd.google-apps.folder'",
            "trashed=false",
        ]
        if owner:
            query_parts.append(
                f"appProperties has {{ key='owner' and value='{_escape_drive_query_value(owner)}' }}"
            )
        if category:
            query_parts.append(
                f"appProperties has {{ key='category' and value='{_escape_drive_query_value(category)}' }}"
            )

        query = " and ".join(query_parts)
        fields = "files(id,name,mimeType,webViewLink,createdTime,appProperties)"
        path = (
            "files?"
            + urllib.parse.urlencode(
                {
                    "q": query,
                    "orderBy": "createdTime desc",
                    "pageSize": str(page_size),
                    "fields": fields,
                    "spaces": "drive",
                }
            )
        )
        raw = json.loads(self._drive_request(path))
        return [self._parse_drive_file(item) for item in raw.get("files", [])]

    def download_file(self, drive_file_id: str) -> bytes:
        return self._drive_request(f"files/{drive_file_id}?alt=media")
