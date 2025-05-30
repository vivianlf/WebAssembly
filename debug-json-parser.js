const JsonParserWasmModule = require('./build/node/json-parser.js');

async function debugJsonParser() {
    try {
        console.log('Loading WebAssembly JSON Parser module...');
        
        // Initialize WebAssembly module
        const wasmInstance = await (JsonParserWasmModule.default ? JsonParserWasmModule.default() : JsonParserWasmModule());
        
        // Wait for module to be ready
        if (wasmInstance.ready) {
            await wasmInstance.ready;
        }
        
        console.log('WebAssembly module loaded successfully');
        console.log('Available functions:', Object.keys(wasmInstance).filter(key => key.startsWith('_')));
        
        // Test with debug function
        console.log('\n=== Testing debug_parse_simple ===');
        const debugParseSimple = wasmInstance.cwrap('debug_parse_simple', 'number', []);
        const freeJsonParserData = wasmInstance.cwrap('free_json_parser_data', null, ['number']);
        
        const resultPtr = debugParseSimple();
        if (resultPtr) {
            const results = [];
            for (let i = 0; i < 4; i++) {
                results.push(wasmInstance.getValue(resultPtr + i * 8, 'double'));
            }
            
            console.log('Debug results:', {
                recordCount: results[0],
                totalSize: results[1], 
                avgValue: results[2],
                parseTime: results[3]
            });
            
            freeJsonParserData(resultPtr);
        } else {
            console.log('Debug function returned null');
        }
        
        // Test with small JSON generation
        console.log('\n=== Testing generate_test_json ===');
        const generateTestJson = wasmInstance.cwrap('generate_test_json', 'number', ['number']);
        const parseJsonData = wasmInstance.cwrap('parse_json_data', 'number', ['number']);
        const freeJsonString = wasmInstance.cwrap('free_json_string', null, ['number']);
        
        // Generate 1MB of JSON data
        const jsonPtr = generateTestJson(1);
        if (jsonPtr) {
            // Get the JSON string length
            let jsonLength = 0;
            while (wasmInstance.getValue(jsonPtr + jsonLength, 'i8') !== 0) {
                jsonLength++;
                if (jsonLength > 2000000) break; // Safety limit
            }
            
            console.log('Generated JSON length:', jsonLength);
            
            // Show first 200 characters
            let preview = '';
            for (let i = 0; i < Math.min(200, jsonLength); i++) {
                preview += String.fromCharCode(wasmInstance.getValue(jsonPtr + i, 'i8'));
            }
            console.log('JSON preview:', preview);
            
            // Parse the JSON
            const parseResultPtr = parseJsonData(jsonPtr);
            if (parseResultPtr) {
                const parseResults = [];
                for (let i = 0; i < 4; i++) {
                    parseResults.push(wasmInstance.getValue(parseResultPtr + i * 8, 'double'));
                }
                
                console.log('Parse results:', {
                    recordCount: parseResults[0],
                    totalSize: parseResults[1],
                    avgValue: parseResults[2], 
                    parseTime: parseResults[3]
                });
                
                freeJsonParserData(parseResultPtr);
            } else {
                console.log('Parse function returned null');
            }
            
            freeJsonString(jsonPtr);
        } else {
            console.log('JSON generation returned null');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugJsonParser(); 