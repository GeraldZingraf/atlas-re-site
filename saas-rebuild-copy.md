# agent-atlas.co - SaaS rebuild copy + structure (M8)

> **Status: DRAFT v2, staged for Gerald's review. Not published.** Copy/IA for the M8
> marketing-site overhaul. Replaces the pay-once downloadable-kit funnel in `index.html` with the
> self-serve SaaS funnel.
>
> **v2 changes:** Broker/team offer removed entirely (Solo only). Copy rewritten against a
> conversion-copywriting playbook (sources below). Plan named **Max** (not Scale).
>
> **Voice:** Agent Atlas brand voice (operator-built, plain, transparent). **No em dashes** in any
> publication copy (hard rule). All real-estate wording is the [PACK] layer; keep it swappable.
>
> **Open upstream (do not hard-bake):**
> 1. **The acquisition wedge.** "Your AI team / the busywork behind your deals" is the safe default;
>    the sharper "never lose a deal to a deadline" wedge is discovery-dependent. Hero options A/B/C
>    below. Pick after discovery.
> 2. **Exact hour allowances + $50 vs $60 Starter** finalize after the first cohort (`PRICING-MODEL.md`).
> 3. **Social proof is thin.** One real testimonial on file (Neil Paine). Do NOT invent others.
>    Flagged slots below get filled as real quotes / logos / numbers come in.

## Copywriting principles applied (so the rationale is visible)
- **Specific, fully descriptive header**, no vague words ("powerful," "leverage"). (Demand Curve, Shapiro)
- **Value-prop formula:** unique + highly desirable + specific, with a number where honest. Rule of One. (Copyhackers)
- **Harry Dry 3-question test** on every line: visualize it / falsify it / no one else could say it. Zoom-in for concreteness.
- **Feature to benefit:** never "has X," always "X so you get [outcome]."
- **CTA continues the promise** + friction reducer. **Social proof is structural**, not decorative.
- Sources: demandcurve.com/playbooks/above-the-fold · copyhackers.com value-prop formula · julian.com/guide/startup/landing-pages · marketingexamples (Harry Dry) · unbounce SaaS landing pages.

---

## Page-level changes vs the live site

| Live site (kill) | Rebuild (ship) |
|---|---|
| "Lives inside Claude Code", "runs on your laptop", "no servers", BYO Claude | Hosted cloud app, used in the browser, sign up and go |
| Pay-once $500 Solo / $1,997 Broker, PayPal `checkout.html` | Subscription hours ladder + 30-day card-on-file trial |
| "Get 3 free" / `free-starter.html` download | One primary CTA: **Start free trial** -> Supabase Auth signup |
| **Broker Kit / small-team fork, "I run a small team", virtual sales manager** | **Removed entirely. Solo agents only. No team/broker copy anywhere.** |
| Virtual Office section + demo video | Command-center dashboard story (`DASHBOARD-SPEC.md`) |
| "Your data stays on your laptop, we run no servers, no telemetry" | Real cloud trust story: DPA, ZDR on Anthropic, per-tenant isolation |
| `meta Purchase` one-time event (deduped by txn) | `trial-start` + `subscription` conversion events |
| `/go/*` attribution links | **Unchanged. Must keep working through the swap.** |

---

## Meta / SEO

- **Title:** Atlas for Real Estate: an AI team that does the busywork behind your deals
- **Description:** Atlas writes your follow-up, builds your listing marketing, and tracks every deadline, in your voice, on top of your CRM. You review and approve. Start free, no card to look around.
- **OG title:** Atlas for Real Estate
- **OG description:** Hire an AI team that handles the busywork behind every deal. In your voice, on top of your CRM. Start a free trial.

---

## Nav

- Left: Atlas for Real Estate (logo + wordmark)
- Right: Pricing . How it works . Sign in . **[Start free trial]** (primary button)

---

## Hero

**Recommended (A): the "your AI team" angle**

- **Eyebrow:** An AI team for solo real estate agents
- **Headline:** Hire an AI team that does the busywork behind your deals.
- **Subhead:** Atlas writes your follow-up, builds your listing marketing, and tracks every closing deadline, in your voice, on top of the CRM you already use. You review and approve. It does the rest.
- **Primary CTA:** Start free trial
- **Friction reducer (under CTA):** 30 days free. No card to look around. Cancel anytime.
- **Secondary link:** See how it works

**Alternate (B): the zoom-in / outcome angle**

- **Headline:** Close the laptop with your follow-up already written.
- **Subhead:** While you are out showing houses, Atlas drafts every lead response, turns each new listing into a full marketing pack, and keeps every deal deadline on track. In your voice. You just approve.

**Alternate (C): the deal-operations wedge (use only if discovery picks it)**

- **Headline:** Never lose a deal to a missed deadline again.
- **Subhead:** Atlas tracks every contingency, inspection, and closing date across all your live deals, then chases the follow-up that keeps them moving. In your voice, on top of your CRM.

*(Hero visual: the command-center dashboard with the employee-hours scoreboard, not a stock photo.)*

---

## Section 1: The problem (sharpened, concrete)

**Kicker:** The problem you already know

**Headline:** Your CRM captures the lead. Then the real work lands on you.

**Body:** Follow Up Boss, Lofty, kvCORE. They are good at capturing leads, running drips, and hosting your IDX site.

Here is what they leave on your desk at 9pm: the follow-up that has to sound like you, the dozen live deals each with their own contingencies and dates, the new listing that needs a description plus three social posts plus a sphere email, the open-house visitors you meant to thank by name, and the Hendersons hitting their twelve-month referral window.

That is the work that decides your year. Right now it is all on you, after hours, when you are tired. That is the work Atlas does.

---

## Section 2: What Atlas is (replaces "drop into Claude Code")

**Kicker:** What Atlas is

**Headline:** A team of AI specialists that works while you are out showing houses.

**Body:** Atlas is a team of AI specialists you run from your browser. You talk to one assistant, the way you would text a real one, and the rest of the team handles the follow-up, the listing marketing, the transaction deadlines, and the past-client outreach behind it. It connects to your CRM and your email, learns your voice from your edits, and stages everything for your approval until you trust it to run on its own.

You stay the only human your clients ever talk to. The busywork behind the deal is just not yours to carry anymore.

**Three cards (feature to benefit):**
- **It sits on top of your CRM, it does not replace it.** Follow Up Boss and Lofty to start. Your CRM stays the source of truth. Atlas is the layer that actually does the work on top of it.
- **It writes in your voice.** It learns from the edits you make in the first couple of weeks, so drafts sound like you, not a template.
- **You stay in control.** Every message waits for your approval until you promote it to send on its own. A fair-housing check runs on anything it drafts.

---

## Section 3: The scoreboard (the proof, replaces "pay once")

**Kicker:** What you get back

**Headline:** Watch the hours add up.

**Body:** Atlas measures every task it finishes in employee-hours, the same way you would measure a real assistant. The follow-up it wrote. The marketing pack it built. The deadlines it tracked. Open your dashboard and see exactly how many hours of work your team did for you this week.

That number is the whole point. It is also how your plan is metered, so you only ever pay for work that actually got done.

*(Visual: the employee-hours scoreboard from the command-center prototype. Once cohort data exists, add a real headline number here, e.g. "early users save an average of NN hours a month." Do not invent it.)*

---

## Section 4: Command center (replaces the Virtual Office)

**Kicker:** Your command center

**Headline:** One screen. Your whole team, what they did, and what needs you.

**Body:** Your home screen shows your agents and what each one is working on, the tasks that ran overnight, a calendar of what is scheduled next, and the hours your team has saved you. Anything that needs your eyes sits in one review queue. You approve, edit, or discard, and the team learns from every call.

When the same task shows up in your week three times, Atlas suggests a new specialist for it. You approve, the team gets stronger. You are never stuck with the team you started with.

*(Visual: command-center dashboard screenshot. Do not reuse the Virtual Office floor-plan video; it is cut from v1.)*

---

## Section 5: A concrete Tuesday (zoom-in proof)

**Kicker:** What changes on a normal Tuesday

- A new lead comes in at 7:40am. Atlas has a personal first touch out the door before you have finished your coffee, not whenever you sit down at night.
- A listing goes live. Atlas turns it into a description, three social posts, and a sphere email in about five minutes, not the four hours it used to take.
- Three deals are mid-contract. Atlas is tracking every contingency and closing date, so nothing slips while you are at a showing.
- A past client hits their referral window. Atlas drafts the check-in on the date that actually brings referrals back.

You review what it staged, approve what is ready, and the rest of the busywork is simply handled.

---

## Section 6: How it works (replaces "buy it now, it sets itself up")

**Kicker:** How it works

**Headline:** Set up in an afternoon. No call, no consultant.

**Steps:**
1. **Start your free trial.** Sign up with email or Google. No card to look around.
2. **Connect your CRM and email.** Follow Up Boss or Lofty, plus Gmail or Outlook. A few clicks.
3. **Hand it two of your own messages.** Atlas reads your voice from them and tunes every draft to sound like you.
4. **See your first win.** Atlas drafts a real follow-up on a real lead, in your voice, before you finish setup.
5. **Approve and go.** Your starting team goes live. You review what it stages. It earns the trust to run routine work on its own.

**Closing line:** The only people in this are you and your clients. There is no call, because there does not need to be one.

---

## Section 7: Pricing (Solo only, Max tier)

**Kicker:** Pricing

**Headline:** Pay for the hours your team works. Nothing else.

**Intro:** Every plan is measured in employee-hours of finished work. Start free for 30 days, then pick a plan. Need more in a busy month? Add hours in blocks. No per-seat fees, no setup fees.

| Plan | Price | Hours / month | Best for |
|---|---|---|---|
| **Starter** | $50 / mo | 100 employee-hours | Solo agents getting leverage without hiring |
| **Pro** | $100 / mo | 250 employee-hours | Busy solo producers with a full pipeline |
| **Max** | $200 / mo | 600 employee-hours | High-volume agents handing off the most |

- **Trial:** 30 days free, card on file, cancel anytime before it ends. We never cut you off in the middle of a task.
- **Buy more:** Out of hours in a heavy month? Add a block without changing your plan.
- **CTA:** Start free trial

*(Notes: hour allowances and $50-vs-$60 Starter provisional until first-cohort cost data, per `PRICING-MODEL.md`. Surface the cap to customers in hours, never dollars. Buy-more / approaching-cap warning / never-cut-off-mid-task behavior per `atlas-plan-usage-prototype.html`.)*

---

## Section 8: Who it is for / not for (Solo only)

**For:**
- Solo agents doing ten or more deals a year who want leverage without hiring an assistant.
- Producers who still carry their own pipeline and are tired of doing the busywork after hours.
- Agents on Follow Up Boss or Lofty who want a layer that does the work, not another inbox to check.

**Not for, and we mean it:**
- Anyone expecting full autopilot on day one. Every message waits for your approval until you promote it.
- Agents on a CRM we do not support yet. We start with Follow Up Boss and Lofty, and add more.

*(No broker/team/brokerage copy. The product is for the individual agent.)*

---

## Section 9: Trust and data (replaces "stays on your laptop")

**Kicker:** Your data

**Headline:** Built to be trusted with your business.

**Body:** Atlas runs in the cloud so your team keeps working when your laptop is closed. Your data is isolated to your account and never mixed with another customer's. The AI runs under a zero-retention agreement, so your clients' information is not used to train anyone's model. You can export or delete your data at any time. Our data processing agreement and the full list of services we rely on are linked below.

*(Must stay accurate to the M0/M2 build: per-tenant RLS, ZDR on the Anthropic account, Supabase/Render. Do not claim "no servers" or "no telemetry"; those were true of the kit and are false of the SaaS.)*

---

## Section 10: Testimonial / social proof

> "Atlas just did it. Super cool, thank you." - Neil Paine, Broker, Sotheby's International Realty

*(This is the one real quote on file. Add more real quotes, brokerage logos, or a headline metric as they come in. Never fabricate. If this is the only proof at launch, keep it to the single quote rather than padding.)*

---

## Section 11: FAQ (SaaS, no broker)

- **Do I need to be technical?** No. You connect your CRM and email with a few clicks and follow a short setup. If you can set up a CRM email filter, you can do this.
- **Does it replace my CRM?** No. It works alongside Follow Up Boss and Lofty. Your CRM stays the source of truth. Atlas is the layer on top that does the drafting, the deadlines, and the voice.
- **Do you send messages for me?** Atlas drafts and stages everything for your approval. You decide what sends automatically once you trust it. It sends by email from your connected account.
- **What does it cost?** Plans start at $50 a month for 100 employee-hours of finished work. Start with a 30-day free trial.
- **What about fair housing?** A fair-housing check runs on every draft. Language touching protected classes gets flagged and replaced with a neutral alternative. It is a backstop, not a replacement for your judgment.
- **Where does my data live and who sees it?** In the cloud, isolated to your account, under a zero-retention model agreement. See our DPA and sub-processor list.
- **Can I cancel?** Anytime. Cancel before your trial ends and you are not charged.

---

## Footer

- Tagline: Atlas for Real Estate. An AI team for the busywork behind your deals.
- Links: Pricing . How it works . Sign in . Start free trial
- Legal: Terms . Privacy . DPA . Acceptable Use . Sub-processors
- Copyright: (c) 2026 Agent Atlas . Richmond, VA

---

## Build checklist (engineering, tracks M8 exit gate)

- [ ] Replace `index.html` hero/sections/pricing/FAQ/footer per above; keep the existing dark-theme design system.
- [ ] Remove the entire Broker Kit / small-team funnel: the `#broker` sections, the hero fork, `checkout.html?sku=broker`, and any "team" language.
- [ ] Remove `checkout.html`, `free-starter.html`, `install-guide.html`, `thank-you.html`, `refund.html` (or repurpose) and the PayPal SDK wiring.
- [ ] Primary CTA points at the app signup (decide: static-links-to-app vs fold into `apps/web`).
- [ ] Re-point `pixel.js` / `google-ads.js`: retire one-time Purchase, fire `trial-start` and `subscription`. Keep the server-side CAPI + Enhanced Conversions wiring, change the events.
- [ ] Verify all 7 `/go/<channel>` links still resolve and `bySource` still populates.
- [ ] Legal pages already reconciled for the SaaS (Render added, SMS/TCPA fixed, Max tier). Just confirm footer links resolve.
- [ ] Replace Virtual Office video with a command-center dashboard visual.
- [ ] QA on mobile + desktop; confirm a cold visitor reaches signup with attribution intact.
