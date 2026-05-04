/* ─────────────────────────────────────────────────────────────────────
 * installation.js
 *
 * Wires up the installation booking + payment form on
 * pages/installation.html. Three integrations are stubbed with
 * REPLACE_ME placeholders that need real values before go-live:
 *
 *   1. Stripe Payment Link  — create a $499 product in your Stripe
 *      dashboard, then a Payment Link for it. Paste the URL below.
 *
 *   2. Formspree endpoint    — create a new Formspree form for
 *      installation bookings, paste the action URL below. Configure
 *      its dashboard recipients to: Peppy Taps + the installer.
 *      (Use Formspree's "rules" to BCC the installer only when
 *      `installation_status` = "PAID" — keeps lead-only enquiries
 *      off the installer's plate.)
 *
 *   3. Cloudinary upload     — sign up at cloudinary.com (free), under
 *      Settings → Upload, create a new "unsigned" upload preset and
 *      copy the cloud name + preset name below. Files (receipts +
 *      photos) upload directly browser → Cloudinary; the returned URLs
 *      get attached to the Formspree submission. No Formspree plan
 *      upgrade needed.
 *
 * The page works end-to-end once all three are filled in. Until then
 * it logs to the console and shows friendly error messages.
 * ───────────────────────────────────────────────────────────────── */

const INSTALLATION_CONFIG = {
    // Stripe Payment Link — paste full URL from Stripe dashboard
    // e.g. 'https://buy.stripe.com/aEU8wKhm3eaT5HOcMM'
    // Optional query params we'll append automatically:
    //   ?prefilled_email=...      (so customer doesn't retype email)
    //   &client_reference_id=...  (so you can match Stripe payment to Formspree submission)
    stripePaymentLink: 'REPLACE_WITH_STRIPE_PAYMENT_LINK',

    // Formspree endpoint for installation bookings
    formspreeUrl: 'https://formspree.io/f/mqenkewe',

    // Cloudinary unsigned upload (free tier)
    cloudinary: {
        cloudName: 'dfe2qvyex',
        uploadPreset: 'peppy_installations'
    },

    // Service-area postcodes. Each entry is either a single postcode
    // (string or number) or an inclusive range `[from, to]`. Replace
    // this placeholder with the real list when known. Until then it's
    // set to Melbourne metro + Geelong + Mornington Peninsula as a
    // safe default for testing.
    serviceablePostcodes: [
        [3000, 3207],   // Melbourne metro
        [3216, 3220],   // Geelong
        [3910, 3944],   // Mornington Peninsula
    ],

    // Standard installation fee (display only — actual charge is set
    // in your Stripe Payment Link).
    priceAud: 499,
};

(function () {
    'use strict';

    const form = document.getElementById('installationForm');
    if (!form) return;

    const statusEl = document.getElementById('instFormStatus');
    const submitBtn = document.getElementById('instSubmit');
    const subjectField = document.getElementById('instSubject');

    const resultPaid = document.getElementById('instResultPaid');
    const resultReview = document.getElementById('instResultReview');

    // ─── Helpers ────────────────────────────────────────────────

    function setStatus(message, tone) {
        statusEl.textContent = message || '';
        if (tone) statusEl.setAttribute('data-tone', tone);
        else statusEl.removeAttribute('data-tone');
    }

    function isPostcodeServiceable(postcode) {
        const pc = parseInt(postcode, 10);
        if (Number.isNaN(pc)) return false;
        return INSTALLATION_CONFIG.serviceablePostcodes.some(entry => {
            if (Array.isArray(entry)) {
                const [from, to] = entry;
                return pc >= from && pc <= to;
            }
            return parseInt(entry, 10) === pc;
        });
    }

    // ─── Conditional UI: stone + no tap-hole warning ────────────

    const tapHoleSelect = document.getElementById('if-tap-hole');
    const benchtopSelect = document.getElementById('if-benchtop');
    const stoneWarning = document.getElementById('if-stone-warning');

    function refreshStoneWarning() {
        const isStone = benchtopSelect.value === 'Stone';
        const noHole = tapHoleSelect.value === 'No' || tapHoleSelect.value === 'Unsure';
        if (isStone && noHole) stoneWarning.classList.add('is-active');
        else stoneWarning.classList.remove('is-active');
    }
    tapHoleSelect.addEventListener('change', refreshStoneWarning);
    benchtopSelect.addEventListener('change', refreshStoneWarning);

    // ─── File upload UI feedback ────────────────────────────────

    function wireFileDrop(inputId, listId, labelId) {
        const input = document.getElementById(inputId);
        const list = document.getElementById(listId);
        const label = labelId ? document.getElementById(labelId) : null;
        const drop = input.closest('.file-drop');
        if (!input || !list) return;

        input.addEventListener('change', () => {
            list.innerHTML = '';
            const files = Array.from(input.files || []);
            if (!files.length) {
                drop && drop.classList.remove('has-file');
                if (label) label.textContent = 'Click or drop your file here';
                return;
            }
            files.forEach(f => {
                const chip = document.createElement('span');
                chip.textContent = f.name;
                list.appendChild(chip);
            });
            drop && drop.classList.add('has-file');
            drop && drop.classList.remove('is-invalid');
            if (label) label.textContent = files.length === 1 ? 'File ready' : files.length + ' files ready';
        });
    }
    wireFileDrop('if-receipt', 'if-receipt-list', 'if-receipt-label');
    wireFileDrop('if-photos', 'if-photos-list');

    // ─── Cloudinary upload ──────────────────────────────────────

    async function uploadToCloudinary(file) {
        const { cloudName, uploadPreset } = INSTALLATION_CONFIG.cloudinary;
        if (!cloudName || cloudName === 'REPLACE_ME') {
            throw new Error('Cloudinary is not configured yet. See INSTALLATION_CONFIG in installation.js.');
        }
        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', uploadPreset);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
            method: 'POST',
            body: fd,
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error('Cloudinary upload failed: ' + errorText.slice(0, 200));
        }
        const data = await res.json();
        return data.secure_url;
    }

    async function uploadAll(files) {
        // Upload sequentially so we don't hammer Cloudinary's free-tier limits
        const urls = [];
        for (const file of files) {
            urls.push(await uploadToCloudinary(file));
        }
        return urls;
    }

    // ─── Validation ─────────────────────────────────────────────

    function clearFieldErrors() {
        form.querySelectorAll('.form-field.has-error').forEach(el => el.classList.remove('has-error'));
        form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        form.querySelectorAll('.form-check.is-required-unchecked').forEach(el => el.classList.remove('is-required-unchecked'));
    }

    function markFieldError(input) {
        input.classList.add('is-invalid');
        const wrap = input.closest('.form-field');
        if (wrap) wrap.classList.add('has-error');
    }

    function validate() {
        clearFieldErrors();
        const errors = [];

        // Required text/select inputs
        form.querySelectorAll('input[required], select[required]').forEach(input => {
            if (input.type === 'checkbox' || input.type === 'file') return;
            if (!input.value.trim()) {
                markFieldError(input);
                errors.push(input.name);
            }
        });

        // Email format
        const emailInput = document.getElementById('if-email');
        if (emailInput.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value)) {
            markFieldError(emailInput);
            errors.push('email_format');
        }

        // Postcode format (4 digits)
        const postcodeInput = document.getElementById('if-postcode');
        if (postcodeInput.value && !/^[0-9]{4}$/.test(postcodeInput.value)) {
            markFieldError(postcodeInput);
            errors.push('postcode_format');
        }

        // Receipt file required
        const receiptInput = document.getElementById('if-receipt');
        if (!receiptInput.files || receiptInput.files.length === 0) {
            const drop = receiptInput.closest('.file-drop');
            if (drop) drop.classList.add('is-invalid');
            errors.push('receipt_missing');
        } else if (receiptInput.files[0].size > 10 * 1024 * 1024) {
            const drop = receiptInput.closest('.file-drop');
            if (drop) drop.classList.add('is-invalid');
            errors.push('receipt_too_large');
        }

        // Required checkboxes
        form.querySelectorAll('input[type="checkbox"][required]').forEach(cb => {
            if (!cb.checked) {
                const wrap = cb.closest('.form-check');
                if (wrap) wrap.classList.add('is-required-unchecked');
                errors.push(cb.name);
            }
        });

        // Honeypot — silently fail if filled
        const hp = form.querySelector('[name="_gotcha"]');
        if (hp && hp.value) errors.push('honeypot');

        return errors;
    }

    // ─── Form submission ────────────────────────────────────────

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const errors = validate();
        if (errors.length > 0) {
            setStatus('Please complete the highlighted fields above.', 'error');
            // Scroll to first error
            const firstError = form.querySelector('.has-error, .is-invalid, .is-required-unchecked');
            if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        const postcode = document.getElementById('if-postcode').value.trim();
        const inServiceArea = isPostcodeServiceable(postcode);

        submitBtn.disabled = true;
        submitBtn.textContent = inServiceArea ? 'Processing…' : 'Submitting…';
        setStatus('Uploading your files — please don\'t close this tab.', 'info');

        try {
            // 1. Upload receipt + photos to Cloudinary
            const receiptInput = document.getElementById('if-receipt');
            const photosInput = document.getElementById('if-photos');

            let receiptUrl = '';
            let photoUrls = [];

            try {
                if (receiptInput.files && receiptInput.files[0]) {
                    receiptUrl = await uploadToCloudinary(receiptInput.files[0]);
                }
                if (photosInput.files && photosInput.files.length > 0) {
                    photoUrls = await uploadAll(Array.from(photosInput.files).slice(0, 5));
                }
            } catch (uploadErr) {
                console.error(uploadErr);
                setStatus('We couldn\'t upload your files. Please try again or email us at enquiries@peppytaps.com.au.', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Continue to payment';
                return;
            }

            // 2. Build the Formspree submission
            setStatus('Sending your booking…', 'info');

            const status = inServiceArea ? 'PAID_PENDING' : 'REVIEW_OUT_OF_AREA';
            subjectField.value = inServiceArea
                ? 'Installation booking — payment pending — Peppy Taps'
                : 'Installation request — review (out of area) — Peppy Taps';

            const fd = new FormData();
            // Manual field collection — keeps file inputs out of the payload
            // (we already uploaded them to Cloudinary).
            const textFields = ['full_name', 'phone', 'email', 'address', 'postcode',
                'retailer', 'store', 'product',
                'tap_hole', 'benchtop_material',
                'schedule_day', 'schedule_time'];
            textFields.forEach(name => {
                const el = form.querySelector(`[name="${name}"]:not([type="checkbox"]):not([type="radio"])`);
                if (el) fd.append(name, el.value);
            });

            // Radio groups (schedule_day / schedule_time)
            ['schedule_day', 'schedule_time'].forEach(name => {
                const checked = form.querySelector(`input[name="${name}"]:checked`);
                if (checked) fd.set(name, checked.value);
            });

            // Checkboxes
            ['check_power', 'check_water', 'check_space',
                'mains_water', 'clearance_confirmed', 'acknowledgement']
                .forEach(name => {
                    const cb = form.querySelector(`input[name="${name}"]`);
                    fd.append(name, cb && cb.checked ? 'Yes' : 'No');
                });

            // Uploaded URLs
            fd.append('receipt_url', receiptUrl);
            fd.append('photo_urls', photoUrls.join('\n'));

            // Meta
            fd.append('installation_status', status);
            fd.append('postcode_in_service_area', inServiceArea ? 'Yes' : 'No');
            fd.append('_subject', subjectField.value);
            fd.append('_replyto', form.querySelector('[name="email"]').value);
            // Honeypot
            const hp = form.querySelector('[name="_gotcha"]');
            if (hp) fd.append('_gotcha', hp.value);

            // 3. Submit to Formspree (skip if not configured — show friendly fallback)
            const formspreeUrl = INSTALLATION_CONFIG.formspreeUrl;
            const formspreeReady = formspreeUrl && !formspreeUrl.startsWith('REPLACE_');

            if (formspreeReady) {
                const res = await fetch(formspreeUrl, {
                    method: 'POST',
                    body: fd,
                    headers: { Accept: 'application/json' },
                });
                if (!res.ok) {
                    throw new Error('Formspree submission failed (' + res.status + ')');
                }
            } else {
                console.warn('[installation] Formspree URL not configured — submission skipped.', {
                    fields: Object.fromEntries(fd.entries()),
                });
            }

            // 4. Branch: redirect to Stripe (in service area) or show review state
            if (inServiceArea) {
                const stripeUrl = INSTALLATION_CONFIG.stripePaymentLink;
                const stripeReady = stripeUrl && !stripeUrl.startsWith('REPLACE_');

                if (stripeReady) {
                    // Build the redirect URL with prefilled email + reference
                    const url = new URL(stripeUrl);
                    url.searchParams.set('prefilled_email', form.querySelector('[name="email"]').value);
                    // client_reference_id helps reconcile Stripe payment ↔ Formspree submission
                    url.searchParams.set('client_reference_id',
                        'inst_' + Date.now().toString(36) + '_' + postcode);
                    setStatus('Redirecting to secure payment…', 'info');
                    window.location.href = url.toString();
                    return;
                } else {
                    console.warn('[installation] Stripe Payment Link not configured.');
                    setStatus('Booking received, but payment is not yet wired up. We\'ll be in touch shortly.', 'info');
                    showResult('paid');
                    return;
                }
            } else {
                // Out of service area — show review confirmation
                showResult('review');
            }

        } catch (err) {
            console.error(err);
            setStatus('Something went wrong. Please try again, or email enquiries@peppytaps.com.au.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Continue to payment';
        }
    });

    function showResult(which) {
        form.style.display = 'none';
        if (which === 'paid') resultPaid.classList.add('is-active');
        else resultReview.classList.add('is-active');
        // Scroll up so the result is visible
        const target = which === 'paid' ? resultPaid : resultReview;
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ─── Stripe return handler ──────────────────────────────────
    // If the customer is sent back here from Stripe with ?paid=true,
    // show the paid-confirmation card without requiring re-submission.
    // (Configure your Stripe Payment Link's "After payment" → "Don't
    // show confirmation page → Redirect customers to your website" →
    // https://www.peppytaps.com.au/pages/installation?paid=true)
    const params = new URLSearchParams(window.location.search);
    if (params.get('paid') === 'true') {
        showResult('paid');
    } else if (params.get('status') === 'review') {
        showResult('review');
    }
})();
