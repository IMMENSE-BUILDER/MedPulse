"""Step-by-step live diagnostic.   Usage (from the project folder):
    C:\\venvs\\medpulse\\Scripts\\python.exe tools\\probe.py "Dolo 650"
Prints what each stage returns or the exact error. API keys are redacted from all output."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings  # noqa: E402
from app.domains import BRANDED_DOMAINS, GENERIC_DOMAINS  # noqa: E402

S = get_settings()
SECRETS = [k for k in (S.tinyfish_api_key, S.gemini_api_key) if k]


def clean(x) -> str:
    s = str(x)
    for k in SECRETS:
        s = s.replace(k, "<redacted>")
    return s


def say(stage, ok, detail=""):
    print(f"[{'OK ' if ok else 'FAIL'}] {stage}" + (f"\n       {clean(detail)[:900]}" if detail else ""), flush=True)


async def main(query: str):
    print(f"mode={S.medpulse_mode} tinyfish_key={'set' if S.has_tinyfish else 'MISSING'} gemini_key={'set' if S.has_gemini else 'MISSING'} model={S.gemini_model}\n")
    if not (S.has_tinyfish and S.has_gemini):
        say("keys", False, "A key is empty. Check .env sits next to main.py and run this from that folder.")
        return
    from app.services.gemini import GeminiService
    from app.services.tinyfish_client import TinyFishService

    gem, tf = GeminiService(S.gemini_api_key, S.gemini_model), TinyFishService(S.tinyfish_api_key)

    salt = query
    try:
        r = await gem.resolve_salt(query)
        say("1 Gemini resolve salt", True, repr(r.model_dump()))
        salt = r.active_salt or query
    except Exception as e:
        say("1 Gemini resolve salt", False, f"{type(e).__name__}: {e}")

    urls = []
    for label, q, doms in (("branded", f"{query} tablet price buy online", BRANDED_DOMAINS), ("generic", f"{salt} tablet price buy online", GENERIC_DOMAINS)):
        for variant, d in (("comma-list filter", doms), ("single-domain filter", doms[:1]), ("no filter", None)):
            try:
                res = await (tf.search(q, d, "probe") if d else tf._client.search.query(q, location="IN", language="en"))
                say(f"2 TinySearch {label} / {variant}", bool(res), f"{len(res if isinstance(res, list) else res.results)} results: " + ", ".join((x['url'] if isinstance(x, dict) else x.url) for x in (res if isinstance(res, list) else res.results)[:4]))
                if res and variant != "no filter" and not urls:
                    urls += [x["url"] for x in res[:2]]
                if res and variant == "no filter" and not urls:
                    urls += [x.url for x in res.results[:2]]
                if res:
                    break
            except Exception as e:
                say(f"2 TinySearch {label} / {variant}", False, f"{type(e).__name__}: {e}")

    if not urls:
        say("3 TinyFetch", False, "skipped: no URLs from search")
        return
    try:
        pages, errs = await tf.fetch(urls[:2], "probe")
        say("3 TinyFetch", bool(pages), f"{len(pages)} pages, errors={errs}; " + " | ".join(f"{p['url']} len={len(p['text'])} head={p['text'][:120]!r}" for p in pages))
    except Exception as e:
        say("3 TinyFetch", False, f"{type(e).__name__}: {e}")
        return
    if pages:
        try:
            out = await gem.extract_offers(pages[0]["text"], query, salt, pages[0]["url"])
            say("4 Gemini extract", True, repr([o.model_dump() for o in out.offers]))
        except Exception as e:
            say("4 Gemini extract", False, f"{type(e).__name__}: {e}")


asyncio.run(main(" ".join(sys.argv[1:]) or "Dolo 650"))
