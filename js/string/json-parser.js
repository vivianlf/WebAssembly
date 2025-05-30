/**
 * JavaScript JSON Parser implementation for comparison with WebAssembly
 * Uses manual parsing to match the C++ implementation complexity
 */
class JsonParserImplementation {
    constructor() {}

    // Generate synthetic JSON data
    generateJsonData(numRecords) {
        const records = [];
        for (let i = 0; i < numRecords; i++) {
            records.push({
                id: i + 1,
                name: `Record_${i + 1}`,
                value: (i + 1) * 3.14159,
                active: i % 2 === 0
            });
        }
        return JSON.stringify(records, null, 2);
    }

    // Generate JSON data of specified size
    generateTestJson(targetSizeMb) {
        // Estimate records needed for target size
        const estimatedRecords = Math.floor(targetSizeMb * 1024 * 1024 / 120); // ~120 bytes per record
        return this.generateJsonData(estimatedRecords);
    }

    // Manual JSON parser (similar to C++ implementation)
    parseJsonManual(jsonStr) {
        const records = [];
        let state = 0; // 0: outside, 1: in array, 2: in object, 3: reading key, 4: expecting colon, 5: reading value
        let currentKey = '';
        let currentValue = '';
        let inString = false;
        let escapeNext = false;
        let currentRecord = {};
        
        for (let i = 0; i < jsonStr.length; i++) {
            const c = jsonStr[i];
            
            if (escapeNext) {
                escapeNext = false;
                if (state === 3) currentKey += c;
                else if (state === 5) currentValue += c;
                continue;
            }
            
            if (c === '\\' && inString) {
                escapeNext = true;
                continue;
            }
            
            if (c === '"') {
                inString = !inString;
                if (!inString) {
                    if (state === 3) {
                        // End of key
                        state = 4; // expecting colon
                    } else if (state === 5) {
                        // End of string value - process key-value pair
                        this.processKeyValue(currentKey, currentValue, currentRecord);
                        currentKey = '';
                        currentValue = '';
                        state = 2; // back to in object
                    }
                } else {
                    // Starting a string
                    if (state === 2) {
                        state = 3; // reading key
                    } else if (state === 4) {
                        state = 5; // reading value after colon
                    }
                }
                continue;
            }
            
            if (inString) {
                if (state === 3) currentKey += c;
                else if (state === 5) currentValue += c;
                continue;
            }
            
            switch (c) {
                case '[':
                    state = 1; // in array
                    break;
                case '{':
                    state = 2; // in object
                    currentRecord = {};
                    break;
                case '}':
                    // Process any remaining non-string value
                    if (currentKey && currentValue) {
                        this.processKeyValue(currentKey, currentValue, currentRecord);
                        currentKey = '';
                        currentValue = '';
                    }
                    state = 1; // back to array
                    records.push(currentRecord);
                    break;
                case ']':
                    state = 0; // end
                    break;
                case ':':
                    if (state === 4) {
                        state = 5; // start reading value
                    }
                    break;
                case ',':
                    // Process any remaining non-string value
                    if (currentKey && currentValue) {
                        this.processKeyValue(currentKey, currentValue, currentRecord);
                        currentKey = '';
                        currentValue = '';
                    }
                    if (state === 2 || state === 5) {
                        state = 2; // next key-value pair in object
                    }
                    break;
                case ' ':
                case '\n':
                case '\t':
                case '\r':
                    // Skip whitespace
                    break;
                default:
                    if (state === 5 && !inString) {
                        currentValue += c;
                    }
                    break;
            }
        }
        
        return records;
    }
    
    // Process key-value pair
    processKeyValue(key, value, record) {
        switch (key) {
            case 'id':
                record.id = parseInt(value);
                break;
            case 'name':
                record.name = value;
                break;
            case 'value':
                record.value = parseFloat(value);
                break;
            case 'active':
                record.active = value === 'true';
                break;
        }
    }

    // Parse JSON and return parsing statistics
    parseJsonData(jsonStr) {
        if (!jsonStr) return null;

        // Measure parsing time
        const startTime = process.hrtime.bigint();
        
        try {
            // Parse JSON using manual parser (matching C++ complexity)
            const records = this.parseJsonManual(jsonStr);
            
            const endTime = process.hrtime.bigint();
            const parseTimeMs = Number(endTime - startTime) / 1000000; // Convert to milliseconds
            
            // Calculate statistics
            let totalValue = 0.0;
            for (const record of records) {
                if (record.value) {
                    totalValue += record.value;
                }
            }
            const avgValue = records.length > 0 ? totalValue / records.length : 0.0;
            
            // Return results: [record_count, total_size, avg_value, parse_time_ms]
            return [
                records.length,
                jsonStr.length,
                avgValue,
                parseTimeMs
            ];
        } catch (error) {
            console.error('JSON parsing error:', error);
            return null;
        }
    }

    // Entry point function to run the JSON parser algorithm
    async runAlgorithm(targetSizeMb) {
        if (targetSizeMb <= 0) return null;
        
        // Generate test data
        const jsonData = this.generateTestJson(targetSizeMb);
        if (!jsonData) return null;
        
        // Parse the data
        const results = this.parseJsonData(jsonData);
        
        return results;
    }
}

module.exports = JsonParserImplementation;
