"""Turn an issue titled "teto|feed", "teto|news" or "teto|poke" into Teto's reply.

The title and login come from strangers, so they arrive only through env vars and are
matched against strict patterns before anything is written.
Writes teto/state.json, the reply to $RUNNER_TEMP/teto-reply.md and result/action to $GITHUB_OUTPUT.
"""
import datetime as dt
import os
import re
import tempfile

from lib import load_json, save_json

FEED = [
    "Mmm, warm bread. Thank you, @{u}~",
    "@{u} brought a baguette. You may stay.",
    "Baguette number {n}! @{u}, you understand me.",
    "Crunchy. @{u} has excellent taste.",
]
POKE = [
    "Hey! ...what is it, @{u}?",
    "@{u}, I'm behind glass, not deaf.",
    "Poke me again and I'll sing at you, @{u}.",
    "That tickles. Do you need something, @{u}?",
]


def out(**kv):
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            for k, v in kv.items():
                f.write(f"{k}={v}\n")
    print(kv)


def main():
    title = os.environ.get("TETO_TITLE", "").strip()
    user = os.environ.get("TETO_USER", "").strip()
    m = re.fullmatch(r"teto\|(feed|news|poke)", title)
    if not m or not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})", user):
        out(result="ignored")
        return
    action = m.group(1)
    state = load_json("state.json")
    state["events"] = state.get("events", 0) + 1
    k = state["events"]

    if action == "feed":
        state["baguettes"] = state.get("baguettes", 0) + 1
        state["last_feeder"] = user
        reply = FEED[k % len(FEED)].format(u=user, n=state["baguettes"])
    elif action == "poke":
        reply = POKE[k % len(POKE)].format(u=user)
    else:
        from build import activity_line  # imported late: build reads the json files on import
        reply = f"@{user} wants news. {activity_line()}"

    state["reply"] = reply
    state["last_event"] = {"action": action, "user": user,
                           "at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    save_json("state.json", state)

    tmp = os.environ.get("RUNNER_TEMP") or tempfile.gettempdir()
    with open(os.path.join(tmp, "teto-reply.md"), "w", encoding="utf-8") as f:
        f.write(f"**Kasane Teto:** {reply}\n\n<sub>She says it on the profile too, give it a minute.</sub>\n")
    out(result="ok", action=action)


if __name__ == "__main__":
    main()
