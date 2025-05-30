/**
 * JavaScript CSV Parser implementation for comparison with WebAssembly
 */
class CsvParserImplementation {
    constructor() {}

    // Generate synthetic CSV data (20 columns)
    generateCsvData(numRecords) {
        let csv = "id,name,value1,value2,value3,category,status,price,quantity,date,score1,score2,score3,priority,description,weight,count,type,ratio,flag\n";
        
        for (let i = 0; i < numRecords; i++) {
            const id = i + 1;
            const name = `Record_${id}`;
            const value1 = (id * 1.5).toFixed(3);
            const value2 = (id * 2.3).toFixed(3);
            const value3 = (id * 0.7).toFixed(3);
            const category = (i % 5) + 1;
            const status = (i % 2 === 0) ? "active" : "inactive";
            const price = (id * 12.99).toFixed(2);
            const quantity = (i % 100) + 1;
            const month = String((i % 12) + 1).padStart(2, '0');
            const day = String((i % 28) + 1).padStart(2, '0');
            const date = `2024-${month}-${day}`;
            const score1 = (id * 0.85).toFixed(3);
            const score2 = (id * 1.15).toFixed(3);
            const score3 = (id * 0.95).toFixed(3);
            const priority = (i % 3) + 1;
            const description = `Description_${id}`;
            const weight = (id * 2.5).toFixed(3);
            const count = (i % 50) + 1;
            const type = (i % 3 === 0) ? "typeA" : (i % 3 === 1) ? "typeB" : "typeC";
            const ratio = (id * 0.123).toFixed(4);
            const flag = i % 2;
            
            csv += `${id},${name},${value1},${value2},${value3},${category},${status},${price},${quantity},${date},${score1},${score2},${score3},${priority},${description},${weight},${count},${type},${ratio},${flag}\n`;
        }
        
        return csv;
    }

    // Generate CSV data of specified size
    generateTestCsv(targetSizeMb) {
        // Estimate records needed for target size (~250 bytes per record with 20 columns)
        const estimatedRecords = Math.floor(targetSizeMb * 1024 * 1024 / 250);
        return this.generateCsvData(estimatedRecords);
    }

    // Parse CSV line into record object
    parseCsvLine(line) {
        const fields = line.split(',');
        
        if (fields.length < 20) {
            return null;
        }
        
        // Clean fields (remove whitespace)
        const cleanFields = fields.map(field => field.trim());
        
        return {
            id: parseInt(cleanFields[0]) || 0,
            name: cleanFields[1] || '',
            value1: parseFloat(cleanFields[2]) || 0.0,
            value2: parseFloat(cleanFields[3]) || 0.0,
            value3: parseFloat(cleanFields[4]) || 0.0,
            category: parseInt(cleanFields[5]) || 0,
            status: cleanFields[6] || '',
            price: parseFloat(cleanFields[7]) || 0.0,
            quantity: parseInt(cleanFields[8]) || 0,
            date: cleanFields[9] || '',
            score1: parseFloat(cleanFields[10]) || 0.0,
            score2: parseFloat(cleanFields[11]) || 0.0,
            score3: parseFloat(cleanFields[12]) || 0.0,
            priority: parseInt(cleanFields[13]) || 0,
            description: cleanFields[14] || '',
            weight: parseFloat(cleanFields[15]) || 0.0,
            count: parseInt(cleanFields[16]) || 0,
            type: cleanFields[17] || '',
            ratio: parseFloat(cleanFields[18]) || 0.0,
            flag: parseInt(cleanFields[19]) || 0
        };
    }

    // Parse CSV string and extract records
    parseCsvString(csvStr) {
        const lines = csvStr.split('\n');
        const records = [];
        let firstLine = true; // Skip header
        
        for (const line of lines) {
            if (firstLine) {
                firstLine = false;
                continue; // Skip header line
            }
            
            if (line.trim() === '') continue;
            
            const record = this.parseCsvLine(line);
            if (record && record.id > 0) {
                records.push(record);
            }
        }
        
        return records;
    }

    // Parse CSV and return parsing statistics
    parseCsvData(csvStr) {
        if (!csvStr) return null;

        // Measure parsing time
        const startTime = process.hrtime.bigint();
        
        try {
            // Parse CSV using custom parser
            const records = this.parseCsvString(csvStr);
            
            const endTime = process.hrtime.bigint();
            const parseTimeMs = Number(endTime - startTime) / 1000000; // Convert to milliseconds
            
            // Calculate statistics
            let totalValue1 = 0.0;
            for (const record of records) {
                if (record.value1) {
                    totalValue1 += record.value1;
                }
            }
            const avgValue1 = records.length > 0 ? totalValue1 / records.length : 0.0;
            
            // Return results: [record_count, total_size, avg_value1, parse_time_ms]
            return [
                records.length,
                csvStr.length,
                avgValue1,
                parseTimeMs
            ];
        } catch (error) {
            console.error('CSV parsing error:', error);
            return null;
        }
    }

    // Entry point function to run the CSV parser algorithm
    async runAlgorithm(targetSizeMb) {
        if (targetSizeMb <= 0) return null;
        
        // Generate test data
        const csvData = this.generateTestCsv(targetSizeMb);
        if (!csvData) return null;
        
        // Parse the data
        const results = this.parseCsvData(csvData);
        
        return results;
    }

    // Get estimated record count for target size
    getEstimatedRecordCount(targetSizeMb) {
        return Math.floor(targetSizeMb * 1024 * 1024 / 250); // ~250 bytes per record with 20 columns
    }
}

module.exports = CsvParserImplementation;
