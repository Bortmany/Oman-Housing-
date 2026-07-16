# Oman Property Intelligence — session instructions

1. **Read `docs/CONVENTIONS.md` before changing anything** — it holds the
   house rules (data honesty, OMR money handling, bilingual/RTL rules) and the
   verify recipe. Code review checks those rules first, in order.
2. **Read `AGENTS.md`** — this repo runs Next.js 16, which has breaking
   changes from what you may expect; its docs ship in
   `node_modules/next/dist/docs/`.
3. **Where the build stands:** all five phases are built; the roadmap
   section at the end of `docs/CONVENTIONS.md` records what each phase
   delivered and where its code lives. What still needs the owner before a
   public launch (host, secrets, payments, email) is in `GO-LIVE.md`.
4. The owner is **not a developer**: commit messages, reports, and summaries
   in plain English.
5. Commanders (dev-lead etc.) never commit or push — the main session does.
