from flask import Flask, request, jsonify
from datetime import datetime, timezone
import math

app = Flask(__name__)

@app.route('/calculate', methods=['POST'])
def calculate():
    timestamp = request.headers.get('X-Calculation-Timestamp')
    if not timestamp:
        timestamp = datetime.now(timezone.utc).isoformat()

    data = request.get_json(silent=True)
    print(
        f"[{timestamp}] Python received: {{ num1: {data.get('num1') if isinstance(data, dict) else None}, "
        f"num2: {data.get('num2', 0) if isinstance(data, dict) else None}, "
        f"operation: '{data.get('operation') if isinstance(data, dict) else None}' }}",
        flush=True,
    )
    if not isinstance(data, dict):
        return jsonify({'error': 'A JSON object is required'}), 400

    operation = data.get('operation')
    try:
        num1 = float(data['num1'])
        num2 = float(data.get('num2', 0) if operation == 'square_root' else data['num2'])
    except (KeyError, TypeError, ValueError):
        return jsonify({'error': 'num1 and num2 must be numbers'}), 400

    if not math.isfinite(num1) or not math.isfinite(num2):
        return jsonify({'error': 'Numbers must be finite'}), 400

    result = None

    if operation == 'add':
        result = num1 + num2
    elif operation == 'subtract':
        result = num1 - num2
    elif operation == 'multiply':
        result = num1 * num2
    elif operation == 'divide':
        if num2 == 0:
            return jsonify({'error': 'Division by zero'}), 400
        result = num1 / num2
    elif operation == 'power':
        try:
            result = math.pow(num1, num2)
        except (OverflowError, ValueError):
            return jsonify({'error': 'Result is outside the supported range'}), 400
    elif operation == 'modulo':
        if num2 == 0:
            return jsonify({'error': 'Modulo by zero'}), 400
        result = num1 % num2
    elif operation == 'square_root':
        if num1 < 0:
            return jsonify({'error': 'Invalid input for square root'}), 400
        result = math.sqrt(num1)
    else:
        return jsonify({'error': 'Invalid operation'}), 400

    if not math.isfinite(result):
        return jsonify({'error': 'Result is outside the supported range'}), 400

    print(
        f"Python calculated: {timestamp},{num1},{num2},{operation},{result},success",
        flush=True,
    )
    return jsonify({'result': result})

if __name__ == '__main__':
    print('Python service: http://127.0.0.1:5001')
    app.run(host='127.0.0.1', port=5001, debug=False)