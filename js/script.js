const dropList = document.querySelectorAll("form select"),
    fromCurrency = document.querySelector(".from select"),
    toCurrency = document.querySelector(".to select"),
    getButton = document.querySelector("form button"),
    exchangeIcon = document.querySelector("form .icon");

for (let i = 0; i < dropList.length; i++) {
    for (let code in country_list) {
        let selected = i === 0 ? (code === "USD" ? "selected" : "") : (code === "AFN" ? "selected" : "");
        let optionTag = `<option value="${code}" ${selected}>${code}</option>`;
        dropList[i].insertAdjacentHTML("beforeend", optionTag);
    }
    dropList[i].addEventListener("change", e => loadFlag(e.target));
}

function loadFlag(element) {
    for (let code in country_list) {
        if (code === element.value) {
            let imgTag = element.parentElement.querySelector("img");
            imgTag.src = `https://flagcdn.com/48x36/${country_list[code].toLowerCase()}.png`;
        }
    }
}

window.addEventListener("load", () => getExchangeRate());

getButton.addEventListener("click", e => {
    e.preventDefault();
    getExchangeRate();
});

exchangeIcon.addEventListener("click", () => {
    let temp = fromCurrency.value;
    fromCurrency.value = toCurrency.value;
    toCurrency.value = temp;
    loadFlag(fromCurrency);
    loadFlag(toCurrency);
    getExchangeRate();
});

// Update on input or currency change
document.querySelector("form input").addEventListener("input", () => getExchangeRate());
fromCurrency.addEventListener("change", () => getExchangeRate());
toCurrency.addEventListener("change", () => getExchangeRate());

async function getExchangeRate() {
    const amount = document.querySelector("form input");
    const exchangeRateTxt = document.querySelector("form .exchange-rate");
    let amountVal = amount.value;

    if (amountVal === "" || amountVal === "0") {
        amount.value = "1";
        amountVal = 1;
    }

    exchangeRateTxt.innerText = "Getting exchange rate...";

    const base = fromCurrency.value;
    const symbol = toCurrency.value;

    try {
        const rate = await fetchRateWithFallback(base, symbol);
        const total = (amountVal * rate).toFixed(2);
        exchangeRateTxt.innerText = `${amountVal} ${base} = ${total} ${symbol}`;
    } catch (err) {
        const cachedRate = getCachedRate(base, symbol);
        if (cachedRate) {
            const total = (amountVal * cachedRate).toFixed(2);
            exchangeRateTxt.innerText = `${amountVal} ${base} ≈ ${total} ${symbol} (cached)`;
            return;
        }
        exchangeRateTxt.innerText = "Something went wrong!";
    }
}

async function fetchRateWithFallback(base, symbol) {
    // Try exchangerate.host first
    const primaryUrl = `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(symbol)}`;
    try {
        const res = await fetch(primaryUrl);
        if (!res.ok) throw new Error("Primary API HTTP error");
        const data = await res.json();
        const rate = data && data.rates && data.rates[symbol];
        if (typeof rate === "number") {
            cacheRates(base, data.rates);
            return rate;
        }
        throw new Error("Primary API missing rate");
    } catch (_) {
        // Fallback 1: Frankfurter
        const frankfurterUrl = `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(symbol)}`;
        try {
            const res = await fetch(frankfurterUrl);
            if (!res.ok) throw new Error("Frankfurter HTTP error");
            const data = await res.json();
            const rate = data && data.rates && data.rates[symbol];
            if (typeof rate === "number") {
                cacheRates(base, data.rates);
                return rate;
            }
            throw new Error("Frankfurter missing rate");
        } catch (__) {
            // Fallback 2: open.er-api.com
            const openErApiUrl = `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
            const res = await fetch(openErApiUrl);
            if (!res.ok) throw new Error("open.er-api HTTP error");
            const data = await res.json();
            if (data && data.result === "success" && data.rates && typeof data.rates[symbol] === "number") {
                cacheRates(base, data.rates);
                return data.rates[symbol];
            }
            throw new Error("open.er-api missing rate");
        }
    }
}

function cacheRates(base, rates) {
    try {
        const payload = { timestamp: Date.now(), base, rates };
        localStorage.setItem(`rates_${base}`, JSON.stringify(payload));
    } catch (_) {}
}

function getCachedRate(base, symbol, maxAgeMs = 12 * 60 * 60 * 1000) { // 12h
    try {
        const raw = localStorage.getItem(`rates_${base}`);
        if (!raw) return null;
        const payload = JSON.parse(raw);
        if (!payload || !payload.timestamp || !payload.rates) return null;
        if (Date.now() - payload.timestamp > maxAgeMs) return null;
        const rate = payload.rates[symbol];
        return typeof rate === "number" ? rate : null;
    } catch (_) {
        return null;
    }
}
