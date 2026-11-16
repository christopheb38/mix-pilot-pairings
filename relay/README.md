# The sharing relay

Decks running Mix Pilot can share the transitions they learned (**Share my transitions** on
the Mix Pilot page, or **Share automatically**, off by default). They send them here: a small
Cloudflare Worker that checks each submission and keeps it until this repository's nightly
`merge shared transitions` workflow collects it.

```
deck ──HTTPS POST /submit──> relay (Cloudflare Worker + KV)  <──GET /pending, POST /ack── merge workflow
                                                                (secret token)          │
                                                                    pairings.tsv <──────┘ check, commit
```

- **No write access to GitHub here.** The repository pulls from the relay with a secret token;
  the relay cannot change the repository.
- **Checked on arrival:** at most 64 KB and 300 transitions per submission, names of 1 to 200
  characters, no control characters, no track-to-itself, duplicates dropped; each submission
  counts once per transition.
- **Capped:** 12 submissions a day from one place. The IP address is used only for that, salted
  and hashed per day, and kept 2 days; it is never stored as is, and nothing identifies a deck.
- **Expiry:** a submission not collected within 30 days is dropped.

Decks find the relay through the `# share: https://...` line at the top of `pairings.tsv`, so
its address can change without a Mix Pilot update.

## Deploy

With a Cloudflare account and Node.js:

```sh
cd relay
npx wrangler login                                   # opens the browser
npx wrangler kv namespace create SUBMISSIONS         # put the printed id in wrangler.toml
openssl rand -hex 32 | npx wrangler secret put SALT
TOKEN=$(openssl rand -hex 32)
echo "$TOKEN" | npx wrangler secret put PULL_TOKEN
echo "$TOKEN" | gh secret set RELAY_PULL_TOKEN -R christopheb38/mix-pilot-pairings
npx wrangler deploy                                  # prints https://mix-pilot-share.<account>.workers.dev
gh variable set RELAY_URL -R christopheb38/mix-pilot-pairings --body "https://mix-pilot-share.<account>.workers.dev"
```

Then add `# share: https://mix-pilot-share.<account>.workers.dev/submit` to the header of
`pairings.tsv`.

## Test

```sh
node relay/test.mjs
```
