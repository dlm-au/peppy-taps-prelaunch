/* ============================================
   HVRA — Main JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

    // --- Navigation scroll behavior ---
    const nav = document.getElementById('nav');
    let lastScroll = 0;

    // Pages with a light/white hero (PDP, configurator, 404) opt out of the
    // transparent-at-top behavior via [data-fixed-nav] so the nav stays solid
    // and readable. Otherwise we'd render white text on a white background
    // when the user is scrolled to the very top.
    const navIsFixed = nav && nav.hasAttribute('data-fixed-nav');
    if (navIsFixed) {
        nav.classList.add('scrolled');
    }

    window.addEventListener('scroll', () => {
        const y = window.scrollY;
        if (!navIsFixed) {
            nav.classList.toggle('scrolled', y > 80);
        }
        lastScroll = y;
    }, { passive: true });

    // --- Mobile menu toggle ---
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');

    if (navToggle) {
        navToggle.addEventListener('click', () => {
            const isActive = navMenu.classList.toggle('active');
            navToggle.classList.toggle('active', isActive);
            navToggle.setAttribute('aria-label', isActive ? 'Close menu' : 'Toggle menu');
            navToggle.setAttribute('aria-expanded', isActive ? 'true' : 'false');
            document.body.style.overflow = isActive ? 'hidden' : '';
        });

        // Close on link click
        navMenu.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
                navToggle.setAttribute('aria-label', 'Toggle menu');
                navToggle.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
            });
        });
    }

    // --- Scroll animations ---
    const animateElements = document.querySelectorAll('[data-animate], [data-animate-stagger]');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, i * 80);
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -60px 0px'
    });

    animateElements.forEach(el => observer.observe(el));

    // --- Finish Selector ---
    const finishOptions = document.querySelectorAll('.finish-option');
    const finishTapImg = document.getElementById('finishTapImg');
    const finishLabel = document.getElementById('finishLabel');

    const finishDescriptions = {
        'chrome': 'Chrome — Mirror-polished, timeless elegance',
        'matte-black': 'Matte Black — Bold, contemporary sophistication',
        'gunmetal': 'Gun Metal Grey — Industrial, refined edge',
        'brushed-nickel': 'Brushed Nickel — Subtle, understated warmth',
        'brushed-brass': 'Brushed Brass Gold — Warm, luxurious character'
    };

    const finishNames = {
        'chrome': 'Chrome',
        'matte-black': 'Matte Black',
        'gunmetal': 'Gun Metal Grey',
        'brushed-nickel': 'Brushed Nickel',
        'brushed-brass': 'Brushed Brass Gold'
    };

    finishOptions.forEach(option => {
        option.addEventListener('click', () => {
            finishOptions.forEach(o => o.classList.remove('active'));
            option.classList.add('active');

            const finish = option.dataset.finish;
            const img = option.dataset.img;
            if (finishTapImg && img) {
                finishTapImg.src = img;
                finishTapImg.alt = 'Signature 5 in 1 — ' + (finishNames[finish] || finish);
            }
            if (finishLabel) finishLabel.textContent = finishDescriptions[finish] || '';
        });
    });

    // --- Smooth scroll for anchor links ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const target = document.querySelector(anchor.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // --- Newsletter form — Mailchimp JSONP integration ---
    // Reads the Mailchimp form endpoint from the form's data-mailchimp-url
    // attribute, switches /post to /post-json (Mailchimp's JSONP variant),
    // and submits the email inline so the user stays on the page.
    const newsletterForm = document.getElementById('newsletterForm');
    if (newsletterForm) {
        const messageEl = document.getElementById('newsletterMessage');
        const emailInput = newsletterForm.querySelector('input[type="email"]');
        const submitBtn = newsletterForm.querySelector('button[type="submit"]');

        function setMessage(text, tone) {
            if (!messageEl) return;
            messageEl.textContent = text;
            messageEl.dataset.tone = tone || '';
        }

        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            const mailchimpUrl = newsletterForm.dataset.mailchimpUrl || '';

            if (!email) return;

            // If no Mailchimp URL configured yet, fall back to friendly placeholder
            // so the form still looks "alive" during site build-out.
            if (!mailchimpUrl || mailchimpUrl === 'REPLACE_WITH_MAILCHIMP_FORM_URL') {
                setMessage('Newsletter signup coming soon — thanks!', 'info');
                emailInput.value = '';
                return;
            }

            // Build JSONP endpoint from Mailchimp embed URL:
            //   .../subscribe/post?u=xxx&id=yyy  →  .../subscribe/post-json?u=xxx&id=yyy
            const jsonpBase = mailchimpUrl.replace('/post?', '/post-json?');

            // Collect the form fields. Include any additional hidden inputs
            // (e.g. the honeypot) so they carry through.
            const params = new URLSearchParams();
            const formData = new FormData(newsletterForm);
            formData.forEach((v, k) => params.append(k, v));

            // Unique callback name so multiple submissions don't collide
            const cbName = 'mcCallback_' + Date.now();
            params.append('c', cbName);

            // Set up callback that Mailchimp will invoke
            window[cbName] = function (data) {
                // Mailchimp returns {result: 'success'|'error', msg: '...'}
                if (data && data.result === 'success') {
                    setMessage('Thanks! Check your inbox to confirm.', 'success');
                    emailInput.value = '';
                    submitBtn.textContent = 'Subscribed!';
                    setTimeout(() => { submitBtn.textContent = 'Subscribe'; }, 3000);
                } else {
                    // Strip HTML that Mailchimp sometimes wraps around error msgs
                    const cleanMsg = (data && data.msg ? data.msg : 'Something went wrong. Please try again.')
                        .replace(/<[^>]+>/g, '');
                    // Common case: "already subscribed" should be soft-positive
                    if (/already subscribed/i.test(cleanMsg)) {
                        setMessage('You\'re already on the list — thanks!', 'info');
                        emailInput.value = '';
                    } else {
                        setMessage(cleanMsg, 'error');
                    }
                }
                // Clean up
                delete window[cbName];
                const s = document.getElementById(cbName + '_script');
                if (s) s.remove();
            };

            // Inject JSONP script
            const script = document.createElement('script');
            script.id = cbName + '_script';
            script.src = jsonpBase + '&' + params.toString();
            script.onerror = () => {
                setMessage('Couldn\'t reach subscription service. Please try again later.', 'error');
                delete window[cbName];
                script.remove();
            };
            document.body.appendChild(script);
            setMessage('Subscribing…', 'info');
        });
    }

    // --- Contact form (contact.html) — Formspree submission ---
    // Reads endpoint from data attribute, falls back to a friendly
    // placeholder when no endpoint is configured.
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        const cfStatus = document.getElementById('contactFormStatus');
        const cfBtn = contactForm.querySelector('button[type="submit"]');

        function setCfStatus(text, tone) {
            if (!cfStatus) return;
            cfStatus.textContent = text;
            cfStatus.dataset.tone = tone || '';
        }

        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Honeypot
            if (contactForm.querySelector('[name="_gotcha"]')?.value) {
                setCfStatus('Thanks!', 'success');
                return;
            }

            const url = contactForm.dataset.formspreeUrl || '';
            if (!url || url === 'REPLACE_WITH_FORMSPREE_URL') {
                setCfStatus('Thanks! (Demo mode — connect Formspree to enable real submissions.)', 'info');
                return;
            }

            const originalLabel = cfBtn.textContent;
            cfBtn.disabled = true;
            cfBtn.textContent = 'Sending…';
            setCfStatus('', '');

            fetch(url, {
                method: 'POST',
                body: new FormData(contactForm),
                headers: { 'Accept': 'application/json' }
            })
            .then(res => {
                if (res.ok) {
                    setCfStatus('Thanks! We\'ll get back to you within one business day.', 'success');
                    contactForm.reset();
                } else {
                    return res.json().then(data => {
                        const errMsg = (data?.errors?.[0]?.message) ||
                            'Something went wrong. Please try again or email enquiries@peppytaps.com.au.';
                        setCfStatus(errMsg, 'error');
                    });
                }
            })
            .catch(() => {
                setCfStatus('Couldn\'t reach the server. Please try again or email enquiries@peppytaps.com.au.', 'error');
            })
            .finally(() => {
                cfBtn.disabled = false;
                cfBtn.textContent = originalLabel;
            });
        });
    }

    // Dealer search is now handled by dealers.js
});
