#!/usr/bin/env python3
"""Atualiza o snapshot publico da live usando a API oficial Twitch Helix."""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

CLIENT_ID = os.environ["TWITCH_CLIENT_ID"]
CLIENT_SECRET = os.environ["TWITCH_CLIENT_SECRET"]
CHANNEL = "agonisingbasher"
OUTPUT = Path("twitch-live.json")

def request_json(url, data=None, headers=None):
    req = Request(url, data=data, headers=headers or {}, method="POST" if data is not None else "GET")
    with urlopen(req, timeout=20) as response:
        return json.load(response)

def main():
    token = request_json(
        "https://id.twitch.tv/oauth2/token",
        data=urlencode({
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "client_credentials",
        }).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )["access_token"]
    result = request_json(
        "https://api.twitch.tv/helix/streams?" + urlencode({"user_login": CHANNEL}),
        headers={"Client-ID": CLIENT_ID, "Authorization": "Bearer " + token},
    )
    streams = result.get("data")
    if not isinstance(streams, list):
        raise ValueError("Resposta inesperada da API Twitch")
    stream = next((s for s in streams if s.get("user_login", "").lower() == CHANNEL and s.get("type") == "live"), None)
    payload = {
        "channel": CHANNEL,
        "checked_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "live": stream is not None,
        "title": str(stream.get("title") or "")[:120] if stream else "",
        "game": str(stream.get("game_name") or "")[:120] if stream else "",
        "viewers": int(stream.get("viewer_count") or 0) if stream else None,
        "started_at": stream.get("started_at") if stream else None,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Twitch Helix: {CHANNEL} live={payload['live']}")

if __name__ == "__main__":
    main()
