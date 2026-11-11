const CUP = '<path d="M4 9h13v5a6.5 6.5 0 0 1-13 0V9Zm13 1h2a3 3 0 0 1 0 6h-2M2 21h19M8 6c-2-2 2-2 0-4m5 4c-2-2 2-2 0-4"/>';
const POT = '<path d="M8 8c-2 2-3 5-2 8s4 5 8 4 6-3 5-6l-2-6H8Zm0 0h10M10 5h6l2 3H8l2-3Zm3 0V3m-1 0h2M6 14 2 8l1 9 5 2m10-9c5-4 6 6 1 6M9 21h8"/>';
const icon = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

module.exports = { CUP, POT, icon };
