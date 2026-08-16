/**
 * Trading Calculator • Quantitative Model
 */

const round2 = val => Number(Math.round(val + "e2") + "e-2");

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getSafetyLevelFromPrice(price, high52) {
    if (!high52 || high52 <= 0) return 0.7;

    const safetyLevel = 0.7 + 0.3 * Math.E * (1 - price / high52);
    return clamp(safetyLevel, 0, 1);
}

function buildQuantityTable(inputs) {
    const rows = [];
    const buyAmount = inputs.previousPrice * inputs.previousQuantity;
    let cumulativeReserve = 0;

    for (let quantity = CONFIG.minQuantity; quantity <= CONFIG.maxQuantity; quantity++) {
        const price = round2(buyAmount / quantity);
        const safetyLevel = getSafetyLevelFromPrice(price, inputs.high52);

        if (price < inputs.previousPrice) {
            cumulativeReserve += buyAmount;
        }

        rows.push({
            quantity,
            price,
            safetyLevel,
            reserveRequired: cumulativeReserve
        });
    }

    return { rows };
}

function findCoveredRow(rows, reserve, previousPrice) {
    if (!reserve || reserve <= 0 || !rows?.length || !previousPrice) {
        return null;
    }

    return [...rows]
        .filter(row => row.price < previousPrice && row.reserveRequired > 0)
        .reverse()
        .find(row => reserve >= row.reserveRequired) ?? null;
}

function calculateSafetyLevel(reserve, quantityTable, previousPrice) {
    if (!reserve || reserve <= 0 || !quantityTable || quantityTable.length === 0) {
        return 0.7;
    }

    const coveredRow = findCoveredRow(quantityTable, reserve, previousPrice);
    return coveredRow ? coveredRow.safetyLevel : 0.7;
}

function calculate(inputs) {
    const { rows: quantityTable } = buildQuantityTable(inputs);
    const buyQuantity = inputs.previousQuantity + 1;
    const buyAmount = inputs.previousPrice * inputs.previousQuantity;
    const buyPrice = round2(buyAmount / buyQuantity);

    const safetyLevel = calculateSafetyLevel(
        inputs.reserve,
        quantityTable,
        inputs.previousPrice
    );

    const margin = 1 / (1.2 - safetyLevel) / 100;
    const sellPrice = round2(inputs.previousPrice * (1 + margin));
    const sellQuantity = Math.max(1, Math.floor(buyAmount / sellPrice) + 1);
    const sellAmount = sellPrice * sellQuantity;

    return {
        safetyLevel,
        margin,
        buy: { price: buyPrice, quantity: buyQuantity, amount: buyAmount },
        sell: { price: sellPrice, quantity: sellQuantity, amount: sellAmount },
        quantityTable
    };
}