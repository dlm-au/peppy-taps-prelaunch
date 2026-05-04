/* ============================================
   Configurator — Peppy Taps
   Real pricing from peppytaps.com.au
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

    let currentStep = 1;
    const totalSteps = 4;

    const selections = { water: null, collection: null, style: null, finish: null };

    // Actual Peppy Taps pricing matrix: [water][collection][style][finish]
    // Prices sourced from peppytaps.com.au/collections/all
    const prices = {
        // 5 in 1 — Signature only
        '5in1': {
            'signature': {
                'standard': { 'chrome': 4999, 'matte-black': 5299, 'brushed-brass-gold': 5499, 'gun-metal-grey': 5499, 'brushed-nickel': 5499 },
                'pullout': null // 5 in 1 pull out not available
            },
            'flagship': null // 5 in 1 flagship not available
        },
        // 4 in 1 Boiling + Chilled
        '4in1-chilled': {
            'flagship': {
                'standard': { 'chrome': 3499, 'matte-black': 3799, 'brushed-brass-gold': 3999, 'gun-metal-grey': 3999, 'brushed-nickel': 3999 },
                'pullout': null // Flagship pull out chilled not listed
            },
            'signature': {
                'standard': { 'chrome': 3999, 'matte-black': 4299, 'brushed-brass-gold': 4499, 'gun-metal-grey': 4499, 'brushed-nickel': 4499 },
                'pullout': { 'chrome': 4499, 'matte-black': 4799, 'brushed-brass-gold': 4999, 'gun-metal-grey': 4999, 'brushed-nickel': 4999 }
            }
        },
        // 4 in 1 Boiling + Ambient
        '4in1-ambient': {
            'flagship': {
                'standard': { 'chrome': 2499, 'matte-black': 2799, 'brushed-brass-gold': 2999, 'gun-metal-grey': 2999, 'brushed-nickel': 2999 },
                'pullout': { 'chrome': 2999, 'matte-black': 3299, 'brushed-brass-gold': 3499, 'gun-metal-grey': 3499, 'brushed-nickel': 3499 }
            },
            'signature': {
                'standard': { 'chrome': 2999, 'matte-black': 3299, 'brushed-brass-gold': 3499, 'gun-metal-grey': 3499, 'brushed-nickel': 3499 },
                'pullout': { 'chrome': 3499, 'matte-black': 3799, 'brushed-brass-gold': 3999, 'gun-metal-grey': 3999, 'brushed-nickel': 3999 }
            }
        }
    };

    const labels = {
        water: { '5in1': '5 in 1 — Boiling, Chilled & Soda', '4in1-chilled': '4 in 1 — Boiling & Chilled', '4in1-ambient': '4 in 1 — Boiling & Ambient' },
        collection: { 'signature': 'Signature', 'flagship': 'Flagship' },
        style: { 'standard': 'Standard', 'pullout': 'Pull Out' },
        finish: { 'chrome': 'Chrome', 'matte-black': 'Matte Black', 'brushed-brass-gold': 'Brushed Brass Gold', 'gun-metal-grey': 'Gun Metal Grey', 'brushed-nickel': 'Brushed Nickel' }
    };

    // Product image mapping: [collection][style][finish] → image path
    const finishToFile = {
        'chrome': 'chrome',
        'matte-black': 'matte-black',
        'brushed-brass-gold': 'brass',
        'gun-metal-grey': 'gunmetal',
        'brushed-nickel': 'nickel'
    };
    function getProductImage(collection, style, finish) {
        const f = finishToFile[finish];
        if (!f) return null;
        if (collection === 'signature') {
            if (style === 'pullout') return `../img/products/sigpullout-${f}.png`;
            // standard — use sig5in1 or sig4in1 depending on water, but visually they look the same
            // Use sig5in1 images for all standard signature (best product shots)
            return `../img/products/sig5in1-${f === 'brass' ? 'brushed-brass' : f === 'nickel' ? 'brushed-nickel' : f}.png`;
        }
        if (collection === 'flagship') {
            if (style === 'pullout') return `../img/products/pullout-${f}-transparent.png`;
            return `../img/products/flagship-${f}.png`;
        }
        return null;
    }

    // Configurator finish slug → PDP finish slug (PDPs use shorter names)
    const finishToPdpSlug = {
        'chrome': 'chrome',
        'matte-black': 'matte-black',
        'brushed-brass-gold': 'brushed-brass',
        'gun-metal-grey': 'gunmetal',
        'brushed-nickel': 'brushed-nickel'
    };

    // Configurator water value → PDP water-mode token. PDPs that support
    // both modes carry data-water-active="ambient|chilled" on .pdp-info
    // and matching .pdp-water-btn[data-water=...] buttons. The 5-in-1
    // (signature 5-in-1, product.html) has no toggle, so we omit the
    // param for that route.
    const waterToPdpMode = {
        '4in1-chilled': 'chilled',
        '4in1-ambient': 'ambient',
        // '5in1' → no toggle on product.html
    };

    // PDP URL mapping: [water][collection][style] → page URL
    // Appends ?finish=<slug> (and ?water=<mode> when relevant) so the
    // destination PDP preselects both the chosen finish and water mode.
    function getPdpUrl() {
        const { water, collection, style, finish } = selections;
        let path = null;
        if (collection === 'signature') {
            if (water === '5in1') path = 'product.html';
            else if (style === 'pullout') path = 'signature-pullout.html';
            else path = 'signature-4in1.html';
        } else if (collection === 'flagship') {
            if (style === 'pullout') path = 'flagship-pullout.html';
            else path = 'flagship-4in1.html';
        }
        if (!path) return null;
        const params = new URLSearchParams();
        const pdpFinish = finishToPdpSlug[finish];
        if (pdpFinish) params.set('finish', pdpFinish);
        const pdpWater = waterToPdpMode[water];
        if (pdpWater) params.set('water', pdpWater);
        const qs = params.toString();
        return qs ? path + '?' + qs : path;
    }

    // Product name for completion state
    function getProductName() {
        const { water, collection, style } = selections;
        const col = labels.collection[collection] || '';
        if (water === '5in1') return `${col} 5 in 1`;
        const styleLabel = style === 'pullout' ? ' Pull Out' : '';
        return `${col}${styleLabel} 4 in 1`;
    }

    // Elements
    const progressFill = document.getElementById('progressFill');
    const stepDots = document.querySelectorAll('.config-step-dot');
    const prevBtn = document.getElementById('prevStep');
    const nextBtn = document.getElementById('nextStep');
    const flagshipOption = document.getElementById('flagshipOption');
    const summaryTapPreview = document.getElementById('summaryTapPreview');

    // Listen for radio changes
    document.querySelectorAll('.config-card input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
            selections[radio.name] = radio.value;

            // If water changes, reset downstream selections that may be invalid
            if (radio.name === 'water') {
                selections.collection = null;
                selections.style = null;
                selections.finish = null;
                document.querySelectorAll('input[name="collection"], input[name="style"], input[name="finish"]').forEach(r => r.checked = false);
                updateAvailability();
            }

            if (radio.name === 'collection') {
                selections.style = null;
                selections.finish = null;
                document.querySelectorAll('input[name="style"], input[name="finish"]').forEach(r => r.checked = false);
                updateAvailability();
            }

            if (radio.name === 'style') {
                selections.finish = null;
                document.querySelectorAll('input[name="finish"]').forEach(r => r.checked = false);
                updateFinishDeltas();
            }

            updateSummary();
            updatePreviewImage();

            // Auto-advance to next step after a short delay
            if (currentStep < totalSteps) {
                setTimeout(() => goToStep(currentStep + 1), 400);
            } else if (currentStep === totalSteps && isComplete()) {
                // Show completion state
                setTimeout(() => showCompletionState(), 400);
            }
        });
    });

    function updateAvailability() {
        // 5 in 1 is Signature only — show unavailability label
        if (flagshipOption) {
            const unavailLabel = flagshipOption.querySelector('.config-unavailable-label');
            if (selections.water === '5in1') {
                flagshipOption.classList.add('config-card--unavailable');
                if (unavailLabel) unavailLabel.textContent = '5 in 1 is Signature only';
            } else {
                flagshipOption.classList.remove('config-card--unavailable');
            }
        }

        // Update pull out availability
        const pulloutCards = document.querySelectorAll('.config-card[data-value="pullout"]');
        pulloutCards.forEach(card => {
            const water = selections.water;
            const collection = selections.collection;
            let available = true;
            let reason = '';

            if (water && collection) {
                const styleGroup = prices[water]?.[collection];
                if (!styleGroup || !styleGroup['pullout']) {
                    available = false;
                    if (water === '5in1') reason = 'Not available for 5 in 1';
                    else reason = 'Not available for this combination';
                }
            }

            const unavailLabel = card.querySelector('.config-unavailable-label');
            if (!available) {
                card.classList.add('config-card--unavailable');
                if (unavailLabel) unavailLabel.textContent = reason;
            } else {
                card.classList.remove('config-card--unavailable');
            }
        });

        updateFinishDeltas();
    }

    // Show price deltas on finish cards relative to Chrome (base)
    function updateFinishDeltas() {
        const { water, collection, style } = selections;
        if (!water || !collection || !style) return;

        const finishPrices = prices[water]?.[collection]?.[style];
        if (!finishPrices) return;

        const basePrice = finishPrices['chrome'] || 0;

        document.querySelectorAll('.config-card--finish').forEach(card => {
            const finishVal = card.dataset.value;
            const deltaEl = card.querySelector('.config-finish-delta');
            if (!deltaEl || !finishPrices[finishVal]) return;

            const delta = finishPrices[finishVal] - basePrice;
            if (delta === 0) {
                deltaEl.textContent = 'Included';
                deltaEl.className = 'config-finish-delta config-finish-delta--included';
            } else {
                deltaEl.textContent = '+$' + delta.toLocaleString();
                deltaEl.className = 'config-finish-delta config-finish-delta--premium';
            }
        });
    }

    // Update the summary preview image — only show when all options are picked
    function updatePreviewImage() {
        if (!summaryTapPreview) return;

        const previewWrap = summaryTapPreview.closest('.config-summary-preview');
        const { collection, style, finish } = selections;
        const placeholder = summaryTapPreview.querySelector('.summary-tap-placeholder');
        let img = summaryTapPreview.querySelector('.summary-tap-img');

        if (collection && style && finish) {
            const src = getProductImage(collection, style, finish);
            if (src) {
                if (!img) {
                    img = document.createElement('img');
                    img.className = 'summary-tap-img';
                    img.alt = 'Your configured tap';
                    summaryTapPreview.appendChild(img);
                }
                img.src = src;
                img.style.display = '';
                if (placeholder) placeholder.style.display = 'none';
                if (previewWrap) previewWrap.classList.add('has-image');
                return;
            }
        }

        // Hide preview until all options picked
        if (img) img.style.display = 'none';
        if (placeholder) placeholder.style.display = 'none';
        if (previewWrap) previewWrap.classList.remove('has-image');
    }

    // Show completion state
    function showCompletionState() {
        const completionEl = document.getElementById('configCompletion');
        const stepsEl = document.querySelector('.config-steps');
        const navButtons = document.querySelector('.config-nav-buttons');

        if (completionEl && stepsEl) {
            stepsEl.style.display = 'none';
            completionEl.style.display = 'block';
            if (navButtons) navButtons.style.display = 'none';

            // Populate completion details
            const nameEl = document.getElementById('completionProductName');
            const finishEl = document.getElementById('completionFinish');
            const priceEl = document.getElementById('completionPrice');
            const linkEl = document.getElementById('completionPdpLink');
            const imgEl = document.getElementById('completionImage');

            if (nameEl) nameEl.textContent = getProductName();
            if (finishEl) finishEl.textContent = labels.finish[selections.finish] || '';
            if (priceEl) {
                const price = getPrice();
                priceEl.textContent = price ? '$' + price.toLocaleString() : '—';
            }
            if (linkEl) {
                const url = getPdpUrl();
                if (url) linkEl.href = url;
            }
            if (imgEl) {
                const src = getProductImage(selections.collection, selections.style, selections.finish);
                if (src) { imgEl.src = src; imgEl.style.display = ''; }
            }

            // Update progress to 100%
            if (progressFill) progressFill.style.width = '100%';
        }
    }

    function hideCompletionState() {
        const completionEl = document.getElementById('configCompletion');
        const stepsEl = document.querySelector('.config-steps');
        const navButtons = document.querySelector('.config-nav-buttons');

        if (completionEl) completionEl.style.display = 'none';
        if (stepsEl) stepsEl.style.display = '';
        if (navButtons) navButtons.style.display = '';
    }

    // Step navigation
    stepDots.forEach(dot => {
        dot.addEventListener('click', () => {
            const target = parseInt(dot.dataset.step);
            hideCompletionState();
            if (target <= currentStep + 1) goToStep(target);
        });
    });

    prevBtn.addEventListener('click', () => {
        hideCompletionState();
        if (currentStep > 1) goToStep(currentStep - 1);
    });
    nextBtn.addEventListener('click', () => {
        if (currentStep < totalSteps) goToStep(currentStep + 1);
    });

    // Find-a-Retailer buttons (#completionFindRetailer, #configFindRetailerSidebar)
    // are plain anchor links to ../index.html#dealers — no JS handler needed.


    // "Edit build" button in completion state
    const editBuildBtn = document.getElementById('editBuild');
    if (editBuildBtn) {
        editBuildBtn.addEventListener('click', () => {
            hideCompletionState();
            goToStep(1);
        });
    }

    function goToStep(step) {
        currentStep = step;
        document.querySelectorAll('.config-step').forEach(s => s.classList.remove('active'));
        const target = document.getElementById('step-' + step);
        if (target) target.classList.add('active');

        progressFill.style.width = ((step / totalSteps) * 100) + '%';

        stepDots.forEach(dot => {
            const dotStep = parseInt(dot.dataset.step);
            dot.classList.remove('active', 'completed');
            if (dotStep === step) dot.classList.add('active');
            else if (dotStep < step) dot.classList.add('completed');
        });

        prevBtn.disabled = step === 1;
        nextBtn.style.display = step === totalSteps ? 'none' : '';

        // On step 4, update finish deltas
        if (step === 4) updateFinishDeltas();

        document.querySelector('.configurator').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function updateSummary() {
        const waterEl = document.getElementById('summaryWater');
        const collectionEl = document.getElementById('summaryCollection');
        const styleEl = document.getElementById('summaryStyle');
        const finishEl = document.getElementById('summaryFinish');
        const totalEl = document.getElementById('totalPrice');

        setSummaryValue(waterEl, selections.water, labels.water);
        setSummaryValue(collectionEl, selections.collection, labels.collection);
        setSummaryValue(styleEl, selections.style, labels.style);
        setSummaryValue(finishEl, selections.finish, labels.finish);

        // Calculate price
        const price = getPrice();
        if (price) {
            totalEl.textContent = '$' + price.toLocaleString();
        } else if (selections.water) {
            // Show "from" price
            const baseFinishes = prices[selections.water];
            if (baseFinishes) {
                let minPrice = Infinity;
                for (const col of Object.values(baseFinishes)) {
                    if (!col) continue;
                    for (const sty of Object.values(col)) {
                        if (!sty) continue;
                        for (const p of Object.values(sty)) {
                            if (p < minPrice) minPrice = p;
                        }
                    }
                }
                totalEl.textContent = minPrice < Infinity ? 'From $' + minPrice.toLocaleString() : '—';
            }
        } else {
            totalEl.textContent = '—';
        }
    }

    function setSummaryValue(el, value, labelMap) {
        if (!el) return;
        if (value && labelMap[value]) {
            el.textContent = labelMap[value];
            el.classList.add('selected');
        } else {
            el.textContent = 'Not selected';
            el.classList.remove('selected');
        }
    }

    function getPrice() {
        const { water, collection, style, finish } = selections;
        if (!water || !collection || !style || !finish) return null;
        return prices[water]?.[collection]?.[style]?.[finish] || null;
    }

    function isComplete() {
        return selections.water && selections.collection && selections.style && selections.finish;
    }
});
