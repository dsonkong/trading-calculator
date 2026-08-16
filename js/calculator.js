/**
 * Trading Calculator • Quantitative Model
 */

const round2 = val => Number(Math.round(val + 'e2') + 'e-2');

/**
 * Calculates price threshold for a given safety level (70 - 100 scale).
 */
function getPriceThreshold(safetyLevel, high52) {
    return high52 * (1 - Math.exp(-1) * (safetyLevel - 70) / 30);
}

/**
 * Inverts the price threshold formula to obtain the exact safetyLevel (0.7 - 1.0 scale).
 */
function getSafetyLevelFromPrice(price, high52) {
    const s = 0.7 + 0.3 * Math.E * (1 - price / high52);
    return Math.min(Math.max(s, 0), 1.0);
}

function buildQuantityTable(inputs) {
    const rows = [];
    const limitAmount = inputs.previousPrice * inputs.previousQuantity;

    const price80 = getPriceThreshold(80, inputs.high52);
    const price90 = getPriceThreshold(90, inputs.high52);
    const price100 = getPriceThreshold(100, inputs.high52);

    for (let quantity = CONFIG.minQuantity; quantity <= CONFIG.maxQuantity; quantity++) {
        const price = round2(limitAmount / quantity);
        const amount = round2(price * quantity);

        rows.push({
            quantity: quantity,
            price: price,
            amount: amount,
            qualifies80: price < inputs.previousPrice && price > price80,
            qualifies90: price < inputs.previousPrice && price > price90,
            qualifies100: price < inputs.previousPrice && price > price100
        });
    }
    return { rows, thresholds: { price80, price90, price100 } };
}

function countQualifyingRows(rows, prop) {
    return rows.filter(r => r[prop]).length;
}

function calculateReserveRequirements(rows, amount) {
    return {
        reserve80: countQualifyingRows(rows, "qualifies80") * amount,
        reserve90: countQualifyingRows(rows, "qualifies90") * amount,
        reserve100: countQualifyingRows(rows, "qualifies100") * amount
    };
}

function calculateSafetyLevel(reserve, buyAmount, quantityTable, high52, previousPrice) {
    if (reserve <= 0 || buyAmount <= 0) return 0.7;

    const validRows = quantityTable
        .filter(r => r.price < previousPrice)
        .sort((a, b) => b.price - a.price);

    if (validRows.length === 0) return 0.7;

    const coveredCount = reserve / buyAmount;

    if (coveredCount > validRows.length) {
        return getSafetyLevelFromPrice(validRows[validRows.length - 1].price, high52);
    }

    const fullRowsCovered = Math.floor(coveredCount);

    const effectivePrice = fullRowsCovered === 0 
        ? high52 
        : validRows[fullRowsCovered].price;

    return getSafetyLevelFromPrice(effectivePrice, high52);
}

function calculate(inputs) {
    const { rows: quantityTable, thresholds } = buildQuantityTable(inputs);

    const buyQuantity = inputs.previousQuantity + 1;
    const buyAmount = inputs.previousPrice * inputs.previousQuantity;
    const buyPrice = round2(buyAmount / buyQuantity);

    const reserveRequired = calculateReserveRequirements(quantityTable, buyAmount);

    const safetyLevel = calculateSafetyLevel(
        inputs.reserve,
        buyAmount,
        quantityTable,
        inputs.high52,
        inputs.previousPrice
    );

    const margin = 1 / (1.2 - safetyLevel) / 100;
    const sellPrice = round2(inputs.previousPrice * (1 + margin));
    const sellQuantity = Math.max(1, Math.floor(buyAmount / sellPrice) + 1);
    const sellAmount = sellPrice * sellQuantity;

    return {
        safetyLevel,
        margin,
        thresholds,
        reserveRequired,
        buy: { price: buyPrice, quantity: buyQuantity, amount: buyAmount },
        sell: { price: sellPrice, quantity: sellQuantity, amount: sellAmount },
        quantityTable
    };
}