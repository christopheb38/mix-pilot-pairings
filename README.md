# Mix Pilot community pairings

**Transitions DJs really play, shared by everyone who uses [Mix Pilot](https://github.com/christopheb38/mix-pilot)**,
the next-track suggestion mod for the Pioneer DJ XDJ-AZ (AZ-MODS).

Every deck running Mix Pilot downloads [`pairings.tsv`](pairings.tsv) when it is online. When
the track you are playing is followed by another one in this file, Mix Pilot ranks that
transition higher and marks it in blue on its panel. The more DJs share, the better the
suggestions get for everybody.

<br>

## Share your transitions

Mix Pilot already records the transitions you play (setting **Learn my transitions**, on by
default). Sharing them takes one press:

**From the deck (easiest).** Open **Mod Menu > Mix Pilot** and press **Share my transitions**.
The row shows how many are new; the deck asks before it sends, then they go over WiFi. Turn on
**Share automatically** to send new ones by themselves when the deck is online (at most about
every 10 minutes). Only the track names are sent: no date, no deck ID. They are merged here
every night ([how it works](relay/README.md)).

**From a computer.** Your transitions are in `MODS/community-mods/mix-pilot/data/my-transitions.tsv`
on your USB stick:

- fork this repository, add your lines to the end of `pairings.tsv`, and open a **pull
  request** (an automatic check tells you if a line is malformed), or
- open an **[issue](../../issues/new)** titled *My transitions* and attach the file (or paste
  its contents): it will be merged for you.

Please share **transitions you actually played and liked**, with real track names. If a
transition is already in the file, raise its count instead of adding the same line again.

<br>

## Format

One transition per line, fields separated by **tabs**:

```
From artist	From title	To artist	To title	count	date
```

| Field | Required | |
|---|---|---|
| From artist, From title | yes | the track playing |
| To artist, To title | yes | the track that followed |
| count | no | how many times it was played, a whole number from 1 to 50 (default 1) |
| date | no | when, any text (Mix Pilot writes `2026-11-09T21:30Z`) |

Lines starting with `#` are comments. Mix Pilot matches titles loosely: `(Original Mix)`,
`(Extended Mix)`, `feat. X`, case and accents do not matter, but a named remix (`(Fisher Remix)`)
is its own track. `my-transitions.tsv` already uses this format, so its lines can be pasted as
they are.

Check the file before you send it:

```sh
python3 tools/check.py pairings.tsv
```

<br>

## Using it

Nothing to do: Mix Pilot uses this file by default while **Online (Last.fm)** is on. To use
another file instead, or none, set `pairings_url` in `MODS/community-mods/mix-pilot/data/config.txt`
on your stick:

```
pairings_url=https://raw.githubusercontent.com/someone/my-pairings/main/pairings.tsv
pairings_url=off
```

Then choose **Mod Menu > Mix Pilot > Reload library**.

<br>

## License

The data is dedicated to the public domain under [CC0 1.0](LICENSE): anyone can use it, for
anything. By contributing, you agree to share your lines under the same terms.

Love Mix Pilot? Follow us on Instagram: [@blinkevents38](https://www.instagram.com/blinkevents38/) ·
[@christopheb_38](https://www.instagram.com/christopheb_38/)
