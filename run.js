(async () => {
    "use strict";

    const API = "https://www.fab.com/i";
    const SELLER = "Quixel Megascans";
    const DELAY = 500;
    const CONCURRENCY = 4;
    const KEY = "fab_quixel_claim_progress_v2";

    const sleep = ms =>
        new Promise(resolve => setTimeout(resolve, ms));

    const csrf = document.cookie.match(
        /(?:^|;\s*)fab_csrftoken=([^;]+)/
    )?.[1];

    if (!csrf) {
        console.error("Fab CSRF token not found.");
        return;
    }

    const headers = {
        Accept: "application/json",
        "X-CsrfToken": decodeURIComponent(csrf)
    };

    async function request(url, options = {}) {
        for (let attempt = 0; attempt < 4; attempt++) {
            const response = await fetch(url, {
                credentials: "same-origin",
                ...options
            });

            if (response.status === 429 ||
                response.status >= 500) {
                if (attempt === 3) {
                    throw new Error(`HTTP ${response.status}`);
                }

                await sleep(2000 * (attempt + 1));
                continue;
            }

            const body = await response.text();

            let data;
            try {
                data = JSON.parse(body);
            } catch {
                data = body;
            }

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}: ${
                        typeof data === "string"
                            ? data.slice(0, 200)
                            : JSON.stringify(data).slice(0, 200)
                    }`
                );
            }

            return data;
        }
    }

    const get = url => request(url, {
        method: "GET",
        headers
    });

    let progress = {};

    try {
        progress = JSON.parse(
            localStorage.getItem(KEY) || "{}"
        );
    } catch (_) {}

    const completed = new Set(progress.completed || []);
    const failed = [];

    function save() {
        localStorage.setItem(KEY, JSON.stringify({
            completed: [...completed],
            updated: new Date().toISOString()
        }));
    }

    // Limited concurrency
    async function mapLimit(items, limit, callback) {
        const results = new Array(items.length);
        let index = 0;

        async function worker() {
            while (true) {
                const current = index++;
                if (current >= items.length) return;

                try {
                    results[current] = await callback(items[current]);
                } catch (error) {
                    results[current] = {
                        error: error.message
                    };
                }
            }
        }

        await Promise.all(
            Array.from(
                { length: Math.min(limit, items.length) },
                worker
            )
        );

        return results;
    }

    // Search catalog
    const baseParams = new URLSearchParams({
        seller: SELLER,
        currency: "USD",
        sort_by: "listingTypeWeight"
    });

    let cursor = null;
    let pageNumber = 0;
    let totalFound = 0;
    let totalAdded = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    console.log("Starting fast Fab claiming...");

    if (!confirm(
        "Start adding free Quixel Megascans assets?\n\n" +
        "Listings will be checked and processed page by page."
    )) return;

    while (true) {
        const params = new URLSearchParams(baseParams);

        if (cursor) params.set("cursor", cursor);

        const page = await get(
            `${API}/listings/search?${params}`
        );

        const items = page.results || [];

        pageNumber++;
        totalFound += items.length;

        console.log(
            `PAGE ${pageNumber}: ${items.length} listings`
        );

        if (!items.length) break;

        // Skip previously completed items
        const pending = items.filter(
            item => item.uid && !completed.has(item.uid)
        );

        // Check details simultaneously
        const details = await mapLimit(
            pending,
            CONCURRENCY,
            async item => {
                const detail = await get(
                    `${API}/listings/${item.uid}`
                );

                const licenses = detail.licenses || [];

                const free = licenses.filter(license => {
                    const tier = license.priceTier;
                    if (!tier || !license.offerId) return false;

                    const price = tier.discountedPrice ??
                                  tier.price;

                    return Number(price) === 0;
                });

                if (!free.length) {
                    return {
                        uid: item.uid,
                        title: detail.title || item.title,
                        skipped: true
                    };
                }

                const selected =
                    free.find(l => l.slug === "professional") ||
                    free.find(l => l.slug === "personal") ||
                    free[0];

                return {
                    uid: item.uid,
                    title: detail.title || item.title,
                    offerId: selected.offerId,
                    license: selected.slug
                };
            }
        );

        const candidates = details.filter(
            d => d && d.uid && !d.error && !d.skipped
        );

        totalSkipped += details.filter(
            d => d?.skipped
        ).length;

        totalFailed += details.filter(
            d => d?.error
        ).length;

        console.log(
            `Free assets on page: ${candidates.length}`
        );

        // Add immediately, without waiting for the whole catalog
        for (const item of candidates) {
            try {
                const form = new FormData();
                form.append("offer_id", item.offerId);

                const result = await request(
                    `${API}/listings/${item.uid}/add-to-library`,
                    {
                        method: "POST",
                        headers,
                        body: form
                    }
                );

                completed.add(item.uid);
                totalAdded++;

                save();

                console.log(
                    `[ADDED] ${item.title} (${item.license})`,
                    result
                );

            } catch (error) {
                totalFailed++;

                failed.push({
                    uid: item.uid,
                    title: item.title,
                    error: error.message
                });

                console.error(
                    `[FAILED] ${item.title}: ${error.message}`
                );

                // Do not mark failed items as completed.
            }

            await sleep(DELAY);
        }

        console.log(
            `PAGE ${pageNumber} COMPLETE | ` +
            `Added: ${totalAdded} | ` +
            `Skipped: ${totalSkipped} | ` +
            `Failed: ${totalFailed}`
        );

        cursor = page.cursors?.next;

        if (!cursor) break;

        await sleep(300);
    }

    save();

    console.log("========== FINISHED ==========");
    console.log("Listings found:", totalFound);
    console.log("Added:", totalAdded);
    console.log("Skipped:", totalSkipped);
    console.log("Failed:", totalFailed);
    console.log("Saved UIDs:", completed.size);

    localStorage.setItem(
        KEY + "_failed",
        JSON.stringify(failed)
    );

    alert(
        "Fab processing finished!\n\n" +
        `Found: ${totalFound}\n` +
        `Added: ${totalAdded}\n` +
        `Skipped: ${totalSkipped}\n` +
        `Failed: ${totalFailed}`
    );
})();
