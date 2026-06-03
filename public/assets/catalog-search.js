document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("search-input");
    const productContainer = document.getElementById("product-container");

    if (!searchInput || !productContainer) {
        return;
    }

    let emptyNotice = document.getElementById("catalog-search-empty");

    if (!emptyNotice) {
        emptyNotice = document.createElement("div");
        emptyNotice.id = "catalog-search-empty";
        emptyNotice.className = "empty-state catalog-search-empty is-hidden";
        emptyNotice.textContent = "Không tìm thấy sản phẩm khớp với từ khóa bạn đang nhập.";
        productContainer.insertAdjacentElement("afterend", emptyNotice);
    }

    const applySearchFilter = () => {
        const keyword = normalizeText(searchInput.value);
        const cards = Array.from(productContainer.querySelectorAll(".product-card"));

        if (!cards.length) {
            emptyNotice.classList.add("is-hidden");
            return;
        }

        let visibleCount = 0;

        cards.forEach((card) => {
            const searchableText = normalizeText(card.dataset.search || card.textContent);
            const isVisible = !keyword || matchesNormalizedQuery(searchableText, keyword);
            card.style.display = isVisible ? "" : "none";

            if (isVisible) {
                visibleCount += 1;
            }
        });

        emptyNotice.classList.toggle("is-hidden", visibleCount > 0 || !keyword);
    };

    ["input", "change", "search", "keyup", "compositionend"].forEach((eventName) => {
        searchInput.addEventListener(eventName, applySearchFilter);
    });

    const observer = new MutationObserver(() => {
        applySearchFilter();
    });

    observer.observe(productContainer, {
        childList: true,
        subtree: true
    });

    applySearchFilter();
});

function normalizeText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();
}

function matchesNormalizedQuery(text, query) {
    const normalizedText = normalizeText(text);
    const normalizedQuery = normalizeText(query);

    if (!normalizedQuery) {
        return true;
    }

    const tokens = normalizedText.split(/[^a-z0-9]+/).filter(Boolean);
    const queryParts = normalizedQuery.split(/\s+/).filter(Boolean);

    return queryParts.every((part) => tokens.some((token) => token.startsWith(part)));
}
