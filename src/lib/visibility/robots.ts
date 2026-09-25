/**
 * robots.txt parsing and matching, following RFC 9309.
 *
 *  - A group is one or more consecutive `user-agent` lines plus the rules
 *    after them. Groups naming the same agent are merged.
 *  - A crawler obeys only the group naming it; `*` applies only when no
 *    group does. This is why `User-agent: *  Disallow: /` does not block a
 *    bot that has its own, more permissive group.
 *  - The longest matching pattern wins, and `allow` wins a tie.
 */

type Rule = { allow: boolean; pattern: string };

export type Robots = {
  groups: Map<string, Rule[]>;
  sitemaps: string[];
};

export type RobotsVerdict = {
  allowed: boolean;
  /** The group that applied: the agent's own token, "*", or null if none did. */
  group: string | null;
  /** The rule that decided it, as written, or null when nothing matched. */
  rule: string | null;
};

/** `GPTBot/1.1` and `gptbot` both name the product token `gptbot`. */
const productToken = (value: string) => value.trim().split("/")[0].trim().toLowerCase();

export function parseRobots(text: string): Robots {
  const groups = new Map<string, Rule[]>();
  const sitemaps: string[] = [];

  let agents: string[] = [];
  let collectingAgents = false;

  for (const rawLine of text.replace(/^﻿/, "").split(/\r\n|\r|\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const colon = line.indexOf(":");
    if (colon === -1) continue;

    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (key === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }

    if (key === "user-agent") {
      if (!collectingAgents) agents = [];
      collectingAgents = true;
      const token = productToken(value);
      if (token) {
        agents.push(token);
        if (!groups.has(token)) groups.set(token, []);
      }
      continue;
    }

    if (key === "allow" || key === "disallow") {
      collectingAgents = false;
      // An empty `Disallow:` means "nothing is disallowed", i.e. no rule.
      if (!value) continue;
      for (const agent of agents) {
        groups.get(agent)?.push({ allow: key === "allow", pattern: value });
      }
    }
  }

  return { groups, sitemaps };
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}${anchored ? "$" : ""}`);
}

/** Percent-encode the way crawlers compare paths, so `/café` matches `/caf%C3%A9`. */
function normalisePath(path: string): string {
  try {
    return encodeURI(decodeURI(path));
  } catch {
    return path;
  }
}

/**
 * Whether `token` may fetch `path`.
 *
 * `path` is the URL's path plus query string, e.g. `/blog?page=2`.
 */
export function isAllowed(robots: Robots, token: string, path: string): RobotsVerdict {
  const own = token.toLowerCase();
  const group = robots.groups.has(own) ? own : robots.groups.has("*") ? "*" : null;
  if (!group) return { allowed: true, group: null, rule: null };

  // RFC 9309 §2.2.2: /robots.txt itself is always fetchable.
  if (path === "/robots.txt") return { allowed: true, group, rule: null };

  const target = normalisePath(path);
  let best: Rule | null = null;

  for (const rule of robots.groups.get(group) ?? []) {
    if (!patternToRegex(normalisePath(rule.pattern)).test(target)) continue;
    if (
      !best ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow && !best.allow)
    ) {
      best = rule;
    }
  }

  if (!best) return { allowed: true, group, rule: null };
  return {
    allowed: best.allow,
    group,
    rule: `${best.allow ? "Allow" : "Disallow"}: ${best.pattern}`,
  };
}
