"""Turn an issue titled "teto|feed", "teto|news" or "teto|poke" into Teto's reply.

The title and login come from strangers, so they arrive only through env vars and are
matched against strict patterns before anything is written.
Writes teto/state.json (baguettes, the reply, the last guests), caches the guest's avatar in
teto/guests/, writes the reply to $RUNNER_TEMP/teto-reply.md and result/action to $GITHUB_OUTPUT.
"""
import os
import re
import tempfile

from lib import LOGIN, fetch_avatar, load_json, mood, now, prune_avatars, save_json, stamp

FEED = [
    "Mmm, warm bread. Thank you, @{u}~",
    "@{u} brought a baguette. You may stay.",
    "Baguette number {n}! @{u}, you understand me.",
    "Crunchy. @{u} has excellent taste.",
]
FEED_HUNGRY = [  # the first baguette after days without one
    "Finally! {d} days, @{u}. I was fading away.",
    "Bread! After {d} days! @{u}, you're my favourite now.",
]
FEED_BIRTHDAY = [
    "A birthday baguette! Best present, @{u}.",
    "@{u} remembered my birthday. With bread. Perfect.",
]
POKE = [
    "Hey! ...what is it, @{u}?",
    "@{u}, I'm behind glass, not deaf.",
    "Poke me again and I'll sing at you, @{u}.",
    "That tickles. Do you need something, @{u}?",
]
POKE_HUNGRY = [
    "Poking doesn't feed me, @{u}. The other button.",
    "@{u}, I'm too hungry to be poked.",
]
POKE_BIRTHDAY = [
    "Poking the birthday girl? Bold, @{u}.",
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
    if not m or not re.fullmatch(LOGIN, user):
        out(result="ignored")
        return
    action = m.group(1)
    cfg, state, when = load_json("config.json"), load_json("state.json"), now()
    was = mood(state, cfg, when)  # how she felt before this visit
    state["events"] = state.get("events", 0) + 1
    k = state["events"]

    def pick(everyday, hungry, birthday):
        lines = birthday if was["birthday"] else hungry if was["hungry"] and was["days"] else everyday
        return lines[k % len(lines)].format(u=user, n=state.get("baguettes", 0), d=was["days"])

    if action == "feed":
        state["baguettes"] = state.get("baguettes", 0) + 1
        state["last_feeder"] = user
        state["last_fed_at"] = stamp(when)
        reply = pick(FEED, FEED_HUNGRY, FEED_BIRTHDAY)
    elif action == "poke":
        reply = pick(POKE, POKE_HUNGRY, POKE_BIRTHDAY)
    else:
        from build import activity_line  # imported late: build reads the json files on import
        reply = f"@{user} wants news. {activity_line()}"

    state["reply"] = reply
    state["last_event"] = {"action": action, "user": user, "at": stamp(when)}
    # the guest list: newest first, one entry per person
    guests = [g for g in state.get("guests", []) if g["user"].lower() != user.lower()]
    state["guests"] = ([{"user": user, "action": action, "at": stamp(when)}] + guests)[: cfg.get("guests_shown", 8)]
    save_json("state.json", state)
    fetch_avatar(user)
    prune_avatars(g["user"] for g in state["guests"])

    tmp = os.environ.get("RUNNER_TEMP") or tempfile.gettempdir()
    with open(os.path.join(tmp, "teto-reply.md"), "w", encoding="utf-8") as f:
        f.write(f"**Kasane Teto:** {reply}\n\n<sub>She says it on the profile too, give it a minute.</sub>\n")
    out(result="ok", action=action)


if __name__ == "__main__":
    main()
