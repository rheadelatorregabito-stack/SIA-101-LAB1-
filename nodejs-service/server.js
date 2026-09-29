const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PYTHON_URL = process.env.PYTHON_URL || 'http://127.0.0.1:5001/calculate';
const CSV_FILE = process.env.CSV_FILE || path.join(__dirname, 'history.csv');
const PUBLIC_DIR = path.join(__dirname, 'public');
const OPERATIONS = new Set(['add', 'subtract', 'multiply', 'divide', 'modulo', 'power', 'square_root']);

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

function toCsvRow(values) {
    const fields = values.map((value) => {
        const field = String(value ?? '');
        return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
    });
    return `${fields.join(',')}\n`;
}

// Siguraduhing may header ang history.csv kung wala pa ito
if (!fs.existsSync(CSV_FILE)) {
    fs.writeFileSync(CSV_FILE, 'timestamp,num1,num2,operation,result,status\n');
}

// API endpoint para sa calculation
app.post('/api/calculate', async (req, res) => {
    const { num1, operation } = req.body || {};
    const num2 = operation === 'square_root' && req.body?.num2 === undefined
        ? 0
        : req.body?.num2;
    const timestamp = new Date().toISOString();

    console.log(`Node.js received: { num1: ${num1}, num2: ${num2}, operation: '${operation}' }`);

    try {
        if (!Number.isFinite(num1) || !Number.isFinite(num2) || !OPERATIONS.has(operation)) {
            throw Object.assign(new Error('Provide finite numbers and a supported operation.'), { status: 400 });
        }

        const pyResponse = await axios.post(
            PYTHON_URL,
            { num1, num2, operation },
            { timeout: 5000, headers: { 'X-Calculation-Timestamp': timestamp } }
        );
        const result = pyResponse.data.result;
        if (!Number.isFinite(result)) {
            throw new Error('The Python service returned an invalid result.');
        }

        const csvRow = toCsvRow([timestamp, num1, num2, operation, result, 'success']);
        console.log(`Node.js history.csv: ${csvRow.trimEnd()}`);
        fs.appendFileSync(CSV_FILE, csvRow);
        return res.json({ result, status: 'success' });
    } catch (error) {
        const upstreamStatus = error.response?.status;
        const statusCode = error.status || (upstreamStatus >= 400 && upstreamStatus < 500
            ? 400
            : error.code === 'ECONNREFUSED'
                ? 503
                : error.code === 'ECONNABORTED'
                    ? 504
                    : 502);
        const message = error.response?.data?.error || (error.code === 'ECONNREFUSED'
            ? 'Python calculation service is unavailable.'
            : error.code === 'ECONNABORTED'
                ? 'Python calculation service timed out.'
                : error.message || 'Calculation failed.');

        console.error(`Calculation failed (${statusCode}): ${message}`);
        const csvRow = toCsvRow([timestamp, num1, num2, operation, `Error: ${message}`, 'failed']);
        console.log(`Node.js history.csv: ${csvRow.trimEnd()}`);
        fs.appendFileSync(CSV_FILE, csvRow);

        return res.status(statusCode).json({ error: message, status: 'failed' });
    }
});

app.listen(PORT, () => {
    console.log(`Node.js Gateway: http://localhost:${PORT}`);
    console.log('Python service: http://localhost:5001');
    console.log(`History CSV: ${CSV_FILE}`);
});