"""Fetch the numbers the README shows and write teto/data.json.

    GITHUB_TOKEN=... LOGIN=2md55nmxkw-arch python teto/fetch.py

Public data only: stars, primary language and last push of the configured projects,
languages by code size across the owner's public non-fork repos, contributions this week.
"""
import datetime as dt
import json
import os
import urllib.request

from lib import load_json, save_json

QUERY = """
query($login: String!) { user(login: $login) {
  repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false) {
    nodes { name isArchived stargazerCount pushedAt primaryLanguage { name }
      languages(first: 12, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } } } }
  contributionsCollection { contributionCalendar { weeks { contributionDays { date contributionCount } } } }
} }"""


def gql(token, login):
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=json.dumps({"query": QUERY, "variables": {"login": login}}).encode(),
        headers={"Authorization": f"bearer {token}", "Content-Type": "application/json", "User-Agent": "teto-readme"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        out = json.load(r)
    if out.get("errors"):
        raise SystemExit(f"GraphQL error: {out['errors']}")
    return out["data"]["user"]


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
            "week_contributions": week}
    save_json("data.json", data)
    print(json.dumps(data, indent=2))


if __name__ == "__main__":
    main()
