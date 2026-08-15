/**
 * Trading Calculator • Quantitative Model
 */

const round2 = val => Number(Math.round(val + 'e2') + 'e-2');

function buildQuantityTable(inputs) {
    const rows = [];
    const limitAmount = inputs.previousPrice * inputs.previousQuantity;

    const price80 = inputs.high52 * (1 - Math.exp(-1) / 3);
    const price90 = inputs.high52 * (1 - Math.exp(-1) * 2 / 3);
    const price100 = inputs.high52 * (1 - Math.exp(-1));

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

function forecastLinear(x, x1, x2, y1, y2) {
    if (x2 === x1) return y1;
    return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}

function calculateSafetyLevel(reserve, req) {
    const { reserve80: r80, reserve90: r90, reserve100: r100 } = req;
    if (reserve <= r80) return forecastLinear(reserve, 0, r80, 0, 0.8);
    if (reserve <= r90) return forecastLinear(reserve, r80, r90, 0.8, 0.9);
    if (reserve <= r100) return forecastLinear(reserve, r90, r100, 0.9, 1.0);
    return 1.0;
}

function calculate(inputs) {
    const { rows: quantityTable, thresholds } = buildQuantityTable(inputs);

    const buyQuantity = inputs.previousQuantity + 1;
    const buyAmount = inputs.previousPrice * inputs.previousQuantity;
    const buyPrice = round2(buyAmount / buyQuantity);

    const reserveRequired = calculateReserveRequirements(quantityTable, buyAmount);
    const safetyLevel = calculateSafetyLevel(inputs.reserve, reserveRequired);

    let margin = CONFIG.margins.base;
    if (inputs.reserve > reserveRequired.reserve100) {
        margin = CONFIG.margins.tier100;
    } else if (inputs.reserve >= reserveRequired.reserve90) {
        margin = CONFIG.margins.tier90;
    } else if (inputs.reserve >= reserveRequired.reserve80) {
        margin = CONFIG.margins.tier80;
    }

    let sellQuantity, sellAmount;
    if (margin < 1 / (inputs.previousQuantity - 1)) {
        sellQuantity = inputs.previousQuantity;
        sellAmount = buyAmount * (1 + margin);
    } else {
        sellQuantity = inputs.previousQuantity - 1;
        sellQuantity = sellQuantity < CONFIG.minQuantity ? 0 : sellQuantity;
        sellAmount = buyAmount;
        margin = 1 / sellQuantity;
    }
    const sellPrice = round2(sellAmount / sellQuantity);

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