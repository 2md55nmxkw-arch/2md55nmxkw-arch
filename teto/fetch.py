"""Fetch the numbers the README shows and write teto/data.json.

    GITHUB_TOKEN=... LOGIN=2md55nmxkw-arch python teto/fetch.py

Public data only: stars, primary language and last push of the configured projects,
languages by code size across the owner's public non-fork repos, contributions per day for
the last 12 weeks. It also fetches the avatar of any guest in state.json that has none cached,
and recounts who fed Teto how many times from the "teto|feed" issues (state.json "feeders"):
interact.py adds one per baguette, this makes the tally exact again whatever happened in between.
"""
import datetime as dt
import json
import os
import re
import urllib.request

from lib import LOGIN, avatar_file, fetch_avatar, load_json, prune_avatars, save_json, top_feeder

QUERY = """
query($login: String!) { user(login: $login) {
  repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false) {
    nodes { name isArchived stargazerCount pushedAt primaryLanguage { name }
      languages(first: 12, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } } } }
  contributionsCollection { contributionCalendar { weeks { contributionDays { date contributionCount } } } }
} }"""


ISSUES = """
query($owner: String!, $name: String!, $after: String) { repository(owner: $owner, name: $name) {
  issues(first: 100, after: $after, orderBy: { field: CREATED_AT, direction: ASC }) {
    pageInfo { hasNextPage endCursor } nodes { title author { login } } }
} }"""


def post(token, query, variables):
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=json.dumps({"query": query, "variables": variables}).encode(),
        headers={"Authorization": f"bearer {token}", "Content-Type": "application/json", "User-Agent": "teto-readme"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        out = json.load(r)
    if out.get("errors"):
        raise SystemExit(f"GraphQL error: {out['errors']}")
    return out["data"]


def gql(token, login):
    return post(token, QUERY, {"login": login})["user"]


def feeders(token, owner, name):
    """{login: baguettes} from every issue titled exactly "teto|feed", oldest first, so the first
    person to reach a count stays ahead of a later tie. None if the history can't be read."""
    counts, after = {}, None
    try:
        for _ in range(50):  # 5000 issues is plenty
            page = post(token, ISSUES, {"owner": owner, "name": name, "after": after})["repository"]["issues"]
            for issue in page["nodes"]:
                login = (issue.get("author") or {}).get("login") or ""
                if issue["title"].strip() == "teto|feed" and re.fullmatch(LOGIN, login):
                    key = next((k for k in counts if k.lower() == login.lower()), login)
                    counts[key] = counts.get(key, 0) + 1
            if not page["pageInfo"]["hasNextPage"]:
                return counts
            after = page["pageInfo"]["endCursor"]
    except (Exception, SystemExit) as e:  # the README still builds; the old tally stays
        print(f"feeders: {e}")
    return None


def main():
    cfg = load_json("config.json")
    user = gql(os.environ["GITHUB_TOKEN"], os.environ.get("LOGIN") or cfg["owner"])
    nodes = {n["name"]: n for n in user["repositories"]["nodes"]}

    repos = {}
    for p in cfg["projects"]:
        n = nodes.get(p["repo"])
        if n:
            repos[p["repo"]] = {"stars": n["stargazerCount"], "language": (n["primaryLanguage"] or {}).get("name"),
                                "pushedAt": n["pushedAt"]}

    sizes = {}
    skip = {r.lower() for r in cfg.get("languages_exclude_repos", [])}
    for n in nodes.values():
        if n["isArchived"] or n["name"].lower() in skip:
            continue
        for e in n["languages"]["edges"]:
            sizes[e["node"]["name"]] = sizes.get(e["node"]["name"], 0) + e["size"]
    total = sum(sizes.values()) or 1
    top = sorted(sizes.items(), key=lambda kv: -kv[1])[: cfg.get("languages_top", 5)]
    languages = [[name, max(1, round(size * 100 / total))] for name, size in top]

    days = [d for w in user["contributionsCollection"]["contributionCalendar"]["weeks"] for d in w["contributionDays"]]
    week = sum(d["contributionCount"] for d in days[-7:])

    old = load_json("data.json", {})
    data = {"generated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "repos": repos or old.get("repos", {}), "languages": languages or old.get("languages", []),
            "week_contributions": week,
            "activity": [d["contributionCount"] for d in days[-84:]]}  # oldest first, today last
    save_json("data.json", data)
    print(json.dumps(data))

    state = load_json("state.json") or {}
    tally = feeders(os.environ["GITHUB_TOKEN"], cfg["owner"], cfg["repo"])
    if tally is not None and tally != state.get("feeders"):
        state["feeders"] = tally
        save_json("state.json", state)
        print("feeders", tally)

    top = top_feeder(state)
    faces = [g["user"] for g in state.get("guests", [])] + ([top[0]] if top else [])
    for login in faces:
        if not avatar_file(login):
            fetch_avatar(login)
    prune_avatars(faces)


if __name__ == "__main__":
    main()
