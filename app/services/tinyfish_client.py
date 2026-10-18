"""Thin async wrapper over the TinyFish SDK (Search -> Fetch -> Operate)."""
from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable

FETCH_BATCH = 10  # API limit per get_contents call


class TinyFishService:
    def __init__(self, api_key: str):
        from tinyfish import AsyncTinyFish

        self._client = AsyncTinyFish(api_key=api_key)

    async def search(self, query: str, domains: list[str], purpose: str) -> list[dict]:
        resp = await self._client.search.query(
            query,
            purpose=purpose,
            location="IN",
            language="en",
            include_domains=",".join(domains),
        )
        return [
            {"url": r.url, "title": r.title, "snippet": r.snippet, "site": r.site_name}
            for r in resp.results
        ]

    async def fetch(self, urls: list[str], purpose: str, ttl: int = 3600) -> tuple[list[dict], list[dict]]:
        """Batch fetch (<=10 URLs per call). Returns (results, errors); one bad URL never fails the batch."""
        results, errors = [], []
        chunks = [urls[i : i + FETCH_BATCH] for i in range(0, len(urls), FETCH_BATCH)]

        async def one(chunk):
            return await self._client.fetch.get_contents(
                chunk, purpose=purpose, format="markdown", ttl=ttl, per_url_timeout_ms=45_000
            )

        for resp in await asyncio.gather(*(one(c) for c in chunks), return_exceptions=True):
            if isinstance(resp, Exception):
                errors.append({"url": "*", "error": f"{type(resp).__name__}: {resp}"})
                continue
            results += [{"url": r.url, "title": r.title, "text": r.text or ""} for r in resp.results]
            errors += [{"url": e.url, "error": e.error} for e in resp.errors]
        return results, errors

    async def run_agent(
        self,
        goal: str,
        url: str,
        output_schema: dict,
        on_progress: Callable[[str], Awaitable[None]] | None = None,
        on_stream_url: Callable[[str], Awaitable[None]] | None = None,
        timeout_s: float = 120,
    ) -> dict[str, Any]:
        """Run a browser agent and stream its steps. Returns {'result':..., 'streaming_url':..., 'error':...}."""
        from tinyfish import BrowserProfile, CompleteEvent, ProgressEvent, StreamingUrlEvent

        out: dict[str, Any] = {"result": None, "streaming_url": None, "error": None}

        async def _run():
            async with self._client.agent.stream(
                goal=goal, url=url, browser_profile=BrowserProfile.STEALTH, output_schema=output_schema
            ) as stream:
                async for event in stream:
                    if isinstance(event, StreamingUrlEvent):
                        out["streaming_url"] = event.streaming_url
                        if on_stream_url:
                            await on_stream_url(event.streaming_url)
                    elif isinstance(event, ProgressEvent):
                        if on_progress:
                            await on_progress(event.purpose)
                    elif isinstance(event, CompleteEvent):
                        out["result"] = event.result_json
                        if event.error is not None:
                            out["error"] = event.error.message

        try:
            await asyncio.wait_for(_run(), timeout_s)
        except asyncio.TimeoutError:
            out["error"] = f"agent timed out after {timeout_s:.0f}s"
        except Exception as e:  # SDK raises typed errors; surface message only
            out["error"] = f"{type(e).__name__}: {e}"
        return out
