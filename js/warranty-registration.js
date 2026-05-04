/* Warranty registration page-specific behaviour.
   Extracted from inline <script> on pages/warranty-registration.html
   so the site-wide CSP can drop script-src 'unsafe-inline'.

     1. Auto-build the SKU from product + finish using the prefixes
        and suffixes baked into the <option data-*> attributes.
     2. File upload UX: show filename + "has-file" state, and
        handle drag/drop.
     3. Form submit via Formspree (with multipart for the file
        upload), graceful demo-mode fallback if endpoint not set.
*/
(function () {
    const form = document.getElementById('warrantyForm');
    if (!form) return;

    // ── SKU auto-fill ──
    const productSel = document.getElementById('reg-product');
    const finishSel  = document.getElementById('reg-finish');
    const skuDisplay = document.getElementById('regSkuDisplay');
    const skuInput   = document.getElementById('regSkuInput');
    const subjectInp = document.getElementById('regSubject');

    function updateSku() {
        const productOpt = productSel.selectedOptions[0];
        const finishOpt  = finishSel.selectedOptions[0];
        const prefix = productOpt?.dataset.prefix || '';
        const suffix = finishOpt?.dataset.suffix || '';

        // Filter cartridge has a fixed SKU, no finish suffix
        let sku = '';
        if (prefix === 'EV961722') {
            sku = 'EV961722';
        } else if (prefix && suffix) {
            sku = prefix + suffix;
        }

        if (sku) {
            skuDisplay.innerHTML = '<strong>' + sku + '</strong>';
            skuInput.value = sku;
        } else {
            skuDisplay.innerHTML = '<span style="color: var(--color-text-muted)">Choose a product and finish to see the SKU</span>';
            skuInput.value = '';
        }

        // Customise email subject
        const productName = productOpt?.value || '';
        const finishName  = finishOpt?.value || '';
        if (productName && finishName) {
            subjectInp.value = 'Warranty registration — ' + productName + ' (' + finishName + ')';
        } else if (productName) {
            subjectInp.value = 'Warranty registration — ' + productName;
        }
    }
    productSel.addEventListener('change', updateSku);
    finishSel.addEventListener('change', updateSku);

    // ── File upload UX ──
    const fileWrap = document.getElementById('regFileWrap');
    const fileInput = document.getElementById('reg-receipt');
    const fileName  = document.getElementById('regFileName');
    const MAX_BYTES = 12 * 1024 * 1024;

    function showFile(file) {
        if (!file) {
            fileWrap.classList.remove('has-file');
            fileName.textContent = '';
            return;
        }
        if (file.size > MAX_BYTES) {
            fileInput.value = '';
            setStatus('That file is over 12MB. Please upload a smaller image or PDF.', 'error');
            return;
        }
        fileWrap.classList.add('has-file');
        fileName.textContent = file.name + ' (' + Math.round(file.size / 1024) + 'KB)';
    }
    fileInput.addEventListener('change', () => showFile(fileInput.files[0]));

    // Drag & drop
    ['dragenter', 'dragover'].forEach(ev => {
        fileWrap.addEventListener(ev, (e) => {
            e.preventDefault();
            fileWrap.classList.add('is-dragover');
        });
    });
    ['dragleave', 'drop'].forEach(ev => {
        fileWrap.addEventListener(ev, (e) => {
            e.preventDefault();
            fileWrap.classList.remove('is-dragover');
        });
    });
    fileWrap.addEventListener('drop', (e) => {
        const f = e.dataTransfer?.files?.[0];
        if (f) {
            fileInput.files = e.dataTransfer.files;
            showFile(f);
        }
    });

    // ── Submit ──
    const statusEl = document.getElementById('regFormStatus');
    function setStatus(text, tone) {
        statusEl.textContent = text;
        statusEl.dataset.tone = tone || '';
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        // Honeypot
        if (form.querySelector('[name="_gotcha"]').value) {
            setStatus('Thanks!', 'success');
            return;
        }

        const url = form.dataset.formspreeUrl || '';
        if (!url || url === 'REPLACE_WITH_FORMSPREE_URL') {
            setStatus('Thanks! (Demo mode — connect Formspree to enable real submissions.)', 'info');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalLabel = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering…';
        setStatus('', '');

        // multipart/form-data submission so the file uploads
        fetch(url, {
            method: 'POST',
            body: new FormData(form),
            headers: { 'Accept': 'application/json' }
        })
        .then(res => {
            if (res.ok) {
                setStatus('Thanks! Your warranty is registered. We\'ve emailed you a confirmation.', 'success');
                form.reset();
                fileWrap.classList.remove('has-file');
                skuDisplay.innerHTML = '<span style="color: var(--color-text-muted)">Choose a product and finish to see the SKU</span>';
                window.scrollTo({ top: form.offsetTop - 100, behavior: 'smooth' });
            } else {
                return res.json().then(data => {
                    const errMsg = (data?.errors?.[0]?.message) ||
                        'Something went wrong. Please try again or email enquiries@peppytaps.com.au.';
                    setStatus(errMsg, 'error');
                });
            }
        })
        .catch(() => {
            setStatus('Couldn\'t reach the server. Please try again or email enquiries@peppytaps.com.au.', 'error');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
        });
    });
})();
