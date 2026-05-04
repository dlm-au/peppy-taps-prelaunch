# Handoff — Integrating Pages CMS into the Peppy Taps site

**For:** the next agent picking this up.
**Goal:** integrate [Pages CMS](https://pagescms.org) so the business owner can edit selected site content via a web UI, without touching code.
**Scope of this first pass:** prove the integration end-to-end on **2–3 small content types** (FAQ, hero copy, lifestyle images). Pricing/products/stockists are explicitly **out of scope** for v1 — see "Don't touch" below.

---

## 0. Read this first (10 min)

1. **`CLAUDE.md`** at repo root — full architectural context. Don't skip. Especially the "Cache-busting", "Page structure", "Homepage v2", and "Vercel deployment + security headers" sections.
2. **This file** — the plan and the rules.
3. **`stockists/README.md`** — owner-facing docs for the existing Sheet-backed stockist locator. Mirror its tone and depth when you write the owner-facing Pages CMS docs.

---

## 1. What "done" looks like for this pass

Concrete success criteria:

- [ ] **`.pages.yml`** at repo root defining schemas for FAQ, hero copy, and a `lifestyle-images` collection
- [ ] **`content/`** directory at repo root holds the editable content as YAML/markdown
- [ ] FAQ entries on `pages/faqs.html` are rendered from `content/faqs.yml`
- [ ] Hero headline + functional subheading + subtitle on `index.html` rendered from `content/hero.yml`
- [ ] Hero image swappable via Pages CMS (uploaded to `img/lifestyle/` in repo, referenced in `content/hero.yml`)
- [ ] **`build.js`** at repo root: a small Node script that reads `content/*.yml` and substitutes into HTML placeholders. Runs on Vercel deploy. ~50–80 lines.
- [ ] `vercel.json` updated with the new build command
- [ ] Owner can log into `app.pagescms.org` with their GitHub account, see the configured content types, edit one FAQ entry, hit save, and have the change appear on the live site within ~2 minutes (Vercel rebuild time)
- [ ] **Owner-facing doc** at `pages-cms/README.md` (mirroring the style of `stockists/README.md`) explaining: how to log in, what they can edit, what they should NOT touch, where to ask for help when something breaks
- [ ] CLAUDE.md updated with a new "Pages CMS" section noting the build step, the content directory, and the schema location

If any of those are missing or broken, you're not done.

---

## 2. Architecture decisions already made

**Lock these in. Don't re-litigate.**

### Why Pages CMS specifically
We compared Pages CMS, Sveltia (Decap fork), CloudCannon, and Sanity in conversation. Decision matrix:

- **Free** required → ruled out CloudCannon ($25/mo) and Sanity (paid escape hatch)
- **Modern UI** preferred → preferred Pages CMS over Sveltia/Decap (form-based UIs all, but Pages CMS is the most polished)
- **No site rebuild as Next/Astro** → ruled out approaches that assume a SSG framework
- **Owner is mid-tier tech-literate** → form-based editing UI is fine (don't need CloudCannon's true visual editing)

### Build approach: tiny custom Node script (not a SSG)
We will **not** rebuild the site as Eleventy/Astro/Next. Reasons:
- Existing site is hand-crafted HTML/CSS — works, looks good, easy to debug
- A SSG migration is 1–2 weeks of work; we want this done in days
- The 4 content types in scope are simple enough that 50 lines of substitution logic is enough

The build script does **string substitution into HTML placeholders**, not template rendering. Read on.

### Placeholder format in HTML
Use HTML comments as visible markers. The build script finds them and replaces between matching `start`/`end`:

```html
<!-- pages-cms:hero-headline -->
Convenience, Sustainability &amp; Aesthetics — <em>All in One Tap</em>
<!-- /pages-cms:hero-headline -->
```

Why comments not data-attributes: the placeholder is invisible to browsers (no extra DOM), and the existing content stays as a sensible default if the build script fails or hasn't run yet. The site is still WYSIWYG-friendly when reading the HTML.

### Content file format: YAML
- More forgiving than JSON for humans (Pages CMS owners might inspect the files in GitHub eventually)
- Pages CMS handles YAML natively
- Multi-line content stays readable

### Hosting model
- **Pages CMS hosted UI**: `app.pagescms.org`. Owner logs in via GitHub OAuth — nothing to install, no account separate from GitHub.
- **Content stored in this repo**: under `content/`. Owner edits propagate as git commits → Vercel auto-deploys.
- **Cost**: $0/month, forever. No upgrade path.

### Build runs on Vercel
- Add `"buildCommand": "node build.js"` to `vercel.json`.
- Local dev still works without the build (placeholder defaults stay in HTML).
- Don't introduce npm dependencies if you can avoid it. Native Node modules (`fs`, `path`) + a tiny YAML parser (`js-yaml` is fine if you must add one) are enough.

---

## 3. Step-by-step work plan

### Phase 1 — Scaffold (Day 1)

1. Create `content/` directory at repo root.
2. Create `pages-cms/README.md` (owner-facing docs, fill in as you go).
3. Create `build.js` at repo root with a stub that reads `content/` and prints what it found. Don't substitute yet — just verify file discovery works.
4. Add `vercel.json` build command:
   ```json
   { "buildCommand": "node build.js" }
   ```
   Verify a Vercel deploy still ships the site.

### Phase 2 — FAQ pilot (Day 2)

This is the easiest content type, prove the loop here before doing more.

1. Open `pages/faqs.html`. Find the existing FAQ entries (look for the `.faq-item` blocks).
2. Extract each FAQ Q+A into `content/faqs.yml`:
   ```yaml
   - question: "How hot is the boiling water?"
     answer: "Our system delivers filtered water at 98°C — hot enough for tea, coffee, and cooking, while being slightly below true boiling point for added safety."
   - question: "Do I need a plumber to install?"
     answer: "Yes — we recommend a licensed plumber for installation. Most installs take 2–3 hours. We provide comprehensive installation guides and videos."
   ```
3. In `pages/faqs.html`, replace the static FAQ block with a placeholder:
   ```html
   <div class="faq-list">
       <!-- pages-cms:faqs-start -->
       <!-- (existing FAQ items rendered here as fallback / cache) -->
       <!-- /pages-cms:faqs-end -->
   </div>
   ```
   Keep the existing rendered HTML between the comments as a fallback so the page still looks right if the build hasn't run.
4. In `build.js`, add the substitution logic:
   - Read `content/faqs.yml`
   - Render each entry as the `.faq-item` HTML the existing CSS/JS expects (look at the original markup carefully — accordion behaviour relies on specific class names)
   - Replace everything between `<!-- pages-cms:faqs-start -->` and `<!-- /pages-cms:faqs-end -->` in `pages/faqs.html`
5. Also update the **JSON-LD `FAQPage` block** in `index.html` if you're rendering FAQs there too — keep them in sync. (Look for the existing `<script type="application/ld+json">` with `"@type": "FAQPage"` in `index.html`.)
6. Add a stanza to `.pages.yml` for the FAQ schema:
   ```yaml
   media: img
   content:
     - name: faqs
       label: FAQ
       path: content/faqs.yml
       type: file
       format: yaml
       fields:
         - name: list
           label: Questions
           type: object
           list: true
           fields:
             - { name: question, label: Question, type: string }
             - { name: answer, label: Answer, type: text }
   ```
   (Check the [Pages CMS docs](https://pagescms.org/docs) — the schema syntax may have evolved since this was written.)
7. Test locally: run `node build.js`, confirm `pages/faqs.html` now has the YAML content rendered between the comment markers.
8. Commit and deploy. Confirm the live site still renders FAQs correctly.
9. **At this point you've proven the architecture.** Stop and verify before moving on.

### Phase 3 — Hero copy (Day 3)

1. Create `content/hero.yml`:
   ```yaml
   eyebrow: "Where Great Design Meets Everyday Ease"
   headline_main: "Convenience, Sustainability"
   headline_emphasis: "All in One Tap"
   functional_line: "Filtered boiling, chilled and sparkling water from a single tap."
   subtitle: "Up to 5 functions from one beautifully designed kitchen fixture — with optional pull-out mixer."
   image: "img/lifestyle/hero1.jpg"
   ```
2. Add placeholder comments around each hero text block in `index.html` AND `pages/home-v2.html` (the two are intentional duplicates — see CLAUDE.md "Homepage v2" section).
3. The hero image is referenced in three places — handle all three:
   - `<meta property="og:image" content="https://peppytaps.com.au/img/lifestyle/hero1.jpg">`
   - `<meta name="twitter:image" content="https://peppytaps.com.au/img/lifestyle/hero1.jpg">`
   - Inline style: `<div class="hero-video-placeholder" style="background: url('img/lifestyle/hero1.jpg') ...">`
4. Add the hero stanza to `.pages.yml`. The image field should let the owner upload to `img/lifestyle/`:
   ```yaml
   - name: hero
     label: Homepage hero
     path: content/hero.yml
     type: file
     format: yaml
     fields:
       - { name: eyebrow, label: Eyebrow text, type: string }
       - { name: headline_main, label: Headline (main), type: string }
       - { name: headline_emphasis, label: Headline (italic emphasis), type: string }
       - { name: functional_line, label: Functional sub-headline, type: string, description: "Plain-English description for first-time visitors. Keep under 80 chars." }
       - { name: subtitle, label: Subtitle, type: text }
       - { name: image, label: Hero image, type: image, options: { input: "img/lifestyle", path: "img/lifestyle" } }
   ```
5. Test the build, confirm the hero on `index.html` renders the YAML content.

### Phase 4 — Lifestyle images (Day 4)

The "Inspiration" section on the homepage and the audience-card backgrounds use lifestyle images. Some are good candidates for owner-edit, others not.

**Edit-friendly:**
- Hero image (already in Phase 3)
- The 4 inspiration grid images (look for `.inspiration-item` in `index.html`)

**Leave alone for v1:**
- The 5 mockup images for collection banners (`peppy-mock-1.png` through `peppy-mock-5.png` in `img/mockup/`) — these are part of the Signature/Flagship card design, not casual content
- All product render PNGs in `img/products/` — coupled to PDP code

For inspiration images:
1. Add a `lifestyle_inspiration` collection to `.pages.yml`
2. Each entry has: image, alt text, optional caption
3. Substitute into the inspiration grid in `index.html` and `pages/home-v2.html`

### Phase 5 — Owner training & docs (Day 5)

1. Write `pages-cms/README.md`. Cover:
   - **Logging in**: go to `app.pagescms.org`, click "Sign in with GitHub", grant access to the `tapware-site` repo
   - **What you can edit**: list the content types and what each controls
   - **What you should NOT touch**: prices, products, stockists (those have their own systems), code/HTML files
   - **Editing flow**: edit → save → wait ~2 min for Vercel to rebuild → confirm on live site
   - **Image uploads**: how to upload a new hero image, file size guidelines (<500KB recommended), supported formats
   - **Where to ask for help**: include Dan's contact (you'll need to get this from him)
2. Walk the owner through one real edit end-to-end while you watch. Note where they get confused. Update the README accordingly.
3. Add a "Pages CMS" section to `CLAUDE.md` covering:
   - Where the schema is (`.pages.yml`)
   - Where the content lives (`content/`)
   - How the build works (`build.js`, runs on Vercel deploy)
   - Which sections of which HTML files are now dynamic
   - How to add new editable content types in future

---

## 4. Don't touch (boundaries)

These have working systems already. Disrupting them is out of scope.

- **Stockist locator** — `pages/where-to-buy.html`, `js/stockists-v4.js`, `css/stockists.css`, `vendor/`. The owner already edits stockists via Google Sheet (see `stockists/README.md`). Do not replace that with Pages CMS.
- **Pricing matrix** — `js/configurator.js` `prices[water][collection][style][finish]` object. Genuinely complex schema, would take significant work to model in CMS, and the owner doesn't change prices often. Leave it in code for v1.
- **Product cards on the homepage and PDPs** — coupled to JS for finish-picker, water-mode toggle, JSON-LD. Out of scope.
- **`vercel.json` security headers** — the strict CSP overlay on `/pages/(where-to-buy|stockists-v3|stockists-v4).html` matters. You can ADD `"buildCommand"` but don't change the headers without understanding why they're there.
- **`pages/home-v1.html`** — historical backup. Leave untouched.
- **Stockists v1–v4 test pages** — frozen for reference.

---

## 5. Gotchas / things that will trip you up

1. **Two homepage files**: `index.html` and `pages/home-v2.html` are intentional duplicates (the v2 source + the production mirror). Any content placeholder you add to one must go in the other, with adjusted paths (`img/...` in root vs `../img/...` in pages/). The CLAUDE.md "Homepage v2" section explains why.
2. **Cache-busting**: every `<script>` and `<link rel="stylesheet">` uses `?v=N`. If your build step modifies HTML, double-check it doesn't break the version strings. Bump them manually if you change CSS/JS as part of this work.
3. **Cookie banner is currently disabled**: see the `<!-- Cookie banner disabled for build -->` comment on every HTML page. Don't accidentally re-enable it. If the owner asks for it back, that's a separate conversation.
4. **Vercel preview deploys**: each PR gets its own preview URL. Test the build there before merging to main.
5. **JSON-LD blocks**: there are several `<script type="application/ld+json">` blocks in `index.html` (Organization, Website, Product list, FAQPage). If you make content editable that's also in JSON-LD (FAQ is the obvious one), keep them in sync — search engines read the JSON-LD, users read the HTML.
6. **Pages CMS auth**: needs the owner's GitHub account to have write access to the repo. If the owner doesn't already have a GitHub account, this is the first hurdle — make sure they create one and Dan adds them to the repo before you start the training session.
7. **YAML escaping**: YAML strings with special characters (colons, quotes, ampersands in HTML entities) need careful quoting. Test edge cases (e.g. an FAQ answer containing `"quoted text"` and `&` symbols).

---

## 6. Validation checklist (before you call it done)

- [ ] Vercel deploy succeeds with the new `buildCommand`
- [ ] `pages/faqs.html` FAQ entries match `content/faqs.yml` after a full deploy
- [ ] Editing `content/faqs.yml` directly in GitHub triggers a deploy and updates the live site within ~2 min
- [ ] Editing the same file via `app.pagescms.org` produces the same result
- [ ] Hero on `index.html` matches `content/hero.yml`
- [ ] OG image meta tag reflects the hero image change (this catches build script bugs that update one place but not another)
- [ ] No console errors on the live site
- [ ] Lighthouse mobile + desktop scores haven't regressed (rough check — they should be the same as before since we're not changing CSS/JS load behaviour)
- [ ] Owner has successfully edited at least one piece of content unsupervised
- [ ] `pages-cms/README.md` is written, accurate, and the owner has read it
- [ ] `CLAUDE.md` updated with the Pages CMS section

---

## 7. After v1 — future content types worth considering

In rough priority order. Don't do these in this pass; flag for the next round:

1. **Reviews/testimonials** — natural CMS content, owner will likely want to add as they come in
2. **Trust bar items** — the certifications row at the top of the homepage. Easy to make editable.
3. **Collection block intro copy** — the "Touch-control taps with integrated digital panels" / "Streamlined 4-in-1 designs" headers above each collection grid
4. **About section copy** — the brand story on the homepage
5. **Where to Buy intro** — the brand intro above the locator
6. **Footer tagline** — currently hardcoded across 22 pages
7. **Stockist locator description text** — the helper copy around the search box

---

## 8. Recommended first action

1. Read this whole document.
2. Read `CLAUDE.md`.
3. Spin up the local dev server (`python3 -m http.server 8765`).
4. Make a working branch: `git checkout -b feat/pages-cms-faq-pilot`.
5. Do **only Phase 1 + Phase 2 (FAQ)** before circling back for review. That's the minimum that proves the architecture works. Don't get ambitious in one go — the FAQ pilot is the gate.

If anything in this document is unclear or you've hit a wall, leave the question + your current state in the PR description and I'll loop back. **Do not improvise architecturally** (e.g. "let's just bring in Astro to make this easier") — the lightweight build-script approach is a deliberate choice, see "Architecture decisions already made" above.

Good luck. The site is in solid shape; keep it that way.
