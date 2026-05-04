/* ─────────────────────────────────────────────────────────────────────
 * become-a-retailer.js
 *
 * Wires up the trade application form on pages/become-a-retailer.html.
 * Submits to the same Formspree endpoint as the installation form;
 * differentiated by the `_subject` and `form_type` fields so you can
 * filter "retailer applications" from "installation bookings" in your
 * Formspree inbox (or via Formspree rules).
 *
 * If you'd prefer a dedicated Formspree form for retailer applications
 * (separate inbox, separate auto-responder), create a new form and
 * paste its URL into RETAILER_CONFIG.formspreeUrl below.
 * ───────────────────────────────────────────────────────────────── */

const RETAILER_CONFIG = {
    formspreeUrl: 'https://formspree.io/f/mqenkewe',
};

(function () {
    'use strict';

    const form = document.getElementById('retailerForm');
    if (!form) return;

    const statusEl = document.getElementById('retFormStatus');
    const submitBtn = document.getElementById('retSubmit');
    const result = document.getElementById('retResult');

    function setStatus(message, tone) {
        statusEl.textContent = message || '';
        if (tone) statusEl.setAttribute('data-tone', tone);
        else statusEl.removeAttribute('data-tone');
    }

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
        const emailInput = document.getElementById('rf-email');
        if (emailInput.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value)) {
            markFieldError(emailInput);
            errors.push('email_format');
        }

        // ABN — strip spaces, must be 11 digits
        const abnInput = document.getElementById('rf-abn');
        const abnDigits = (abnInput.value || '').replace(/\s+/g, '');
        if (abnDigits && !/^[0-9]{11}$/.test(abnDigits)) {
            markFieldError(abnInput);
            errors.push('abn_format');
        }

        // Postcode — 4 digits
        const postcodeInput = document.getElementById('rf-postcode');
        if (postcodeInput.value && !/^[0-9]{4}$/.test(postcodeInput.value)) {
            markFieldError(postcodeInput);
            errors.push('postcode_format');
        }

        // Required acknowledgement checkbox
        form.querySelectorAll('input[type="checkbox"][required]').forEach(cb => {
            if (!cb.checked) {
                const wrap = cb.closest('.form-check');
                if (wrap) wrap.classList.add('is-required-unchecked');
                errors.push(cb.name);
            }
        });

        // Honeypot — silently fail if filled (treat as validation error so
        // we don't show the user a friendly message that helps bots)
        const hp = form.querySelector('[name="_gotcha"]');
        if (hp && hp.value) errors.push('honeypot');

        return errors;
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const errors = validate();
        if (errors.length > 0) {
            setStatus('Please complete the highlighted fields above.', 'error');
            const firstError = form.querySelector('.has-error, .is-invalid, .is-required-unchecked');
            if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting…';
        setStatus('Sending your application…', 'info');

        try {
            // Build the FormData manually so we can collapse multi-value fields
            // (business_type[]) into a single comma-separated string for the
            // Formspree email — easier to scan in your inbox.
            const fd = new FormData();

            // Single-value text/select fields
            const textFields = [
                'business_name', 'trading_name', 'abn', 'years_trading', 'locations', 'website',
                'address', 'suburb', 'state', 'postcode',
                'contact_name', 'position', 'email', 'phone',
                'current_brands', 'display_space', 'heard_from', 'message'
            ];
            textFields.forEach(name => {
                const el = form.querySelector(`[name="${name}"]`);
                if (el) fd.append(name, el.value || '');
            });

            // Multi-checkbox: business_type → comma-separated
            const businessTypes = Array.from(form.querySelectorAll('input[name="business_type"]:checked'))
                .map(cb => cb.value);
            fd.append('business_type', businessTypes.join(', ') || '(none selected)');

            // Acknowledgements
            ['acknowledgement', 'marketing_opt_in'].forEach(name => {
                const cb = form.querySelector(`input[name="${name}"]`);
                fd.append(name, cb && cb.checked ? 'Yes' : 'No');
            });

            // Meta
            fd.append('form_type', 'retailer_application');
            fd.append('_subject', 'New retailer application — Peppy Taps');
            fd.append('_replyto', form.querySelector('[name="email"]').value);
            const hp = form.querySelector('[name="_gotcha"]');
            if (hp) fd.append('_gotcha', hp.value);

            const formspreeUrl = RETAILER_CONFIG.formspreeUrl;
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
                console.warn('[retailer] Formspree URL not configured — submission skipped.', {
                    fields: Object.fromEntries(fd.entries()),
                });
            }

            // Show success
            form.style.display = 'none';
            result.classList.add('is-active');
            result.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (err) {
            console.error(err);
            setStatus('Something went wrong submitting your application. Please try again, or email enquiries@peppytaps.com.au.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit application';
        }
    });
})();
