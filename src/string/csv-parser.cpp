#include <emscripten/emscripten.h>
#include <string>
#include <vector>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <chrono>

extern "C" {

// CSV record structure (20 columns)
struct CsvRecord {
    int id;
    char name[32];
    double value1;
    double value2;
    double value3;
    int category;
    char status[16];
    double price;
    int quantity;
    char date[12];
    double score1;
    double score2;
    double score3;
    int priority;
    char description[64];
    double weight;
    int count;
    char type[16];
    double ratio;
    int flag;
};

// Generate synthetic CSV data (internal function, not exported)
void generate_csv_data_internal(int num_records, char* buffer, size_t buffer_size) {
    size_t pos = 0;
    
    // CSV header (20 columns)
    pos += snprintf(buffer + pos, buffer_size - pos,
        "id,name,value1,value2,value3,category,status,price,quantity,date,score1,score2,score3,priority,description,weight,count,type,ratio,flag\n");
    
    for (int i = 0; i < num_records && pos < buffer_size - 500; i++) {
        pos += snprintf(buffer + pos, buffer_size - pos,
            "%d,Record_%d,%.3f,%.3f,%.3f,%d,%s,%.2f,%d,2024-%02d-%02d,%.3f,%.3f,%.3f,%d,Description_%d,%.3f,%d,%s,%.4f,%d\n",
            i + 1,                                    // id
            i + 1,                                    // name
            (i + 1) * 1.5,                           // value1
            (i + 1) * 2.3,                           // value2
            (i + 1) * 0.7,                           // value3
            (i % 5) + 1,                             // category (1-5)
            (i % 2 == 0) ? "active" : "inactive",    // status
            (i + 1) * 12.99,                         // price
            (i % 100) + 1,                           // quantity (1-100)
            ((i % 12) + 1),                          // month
            ((i % 28) + 1),                          // day
            (i + 1) * 0.85,                          // score1
            (i + 1) * 1.15,                          // score2
            (i + 1) * 0.95,                          // score3
            (i % 3) + 1,                             // priority (1-3)
            i + 1,                                    // description
            (i + 1) * 2.5,                           // weight
            (i % 50) + 1,                            // count (1-50)
            (i % 3 == 0) ? "typeA" : (i % 3 == 1) ? "typeB" : "typeC", // type
            (i + 1) * 0.123,                         // ratio
            i % 2                                     // flag (0 or 1)
        );
    }
}

// Process a parsed CSV field and store it in the record
void process_csv_field(const char* field, int field_index, CsvRecord* record) {
    switch (field_index) {
        case 0: record->id = atoi(field); break;
        case 1: strncpy(record->name, field, 31); record->name[31] = '\0'; break;
        case 2: record->value1 = atof(field); break;
        case 3: record->value2 = atof(field); break;
        case 4: record->value3 = atof(field); break;
        case 5: record->category = atoi(field); break;
        case 6: strncpy(record->status, field, 15); record->status[15] = '\0'; break;
        case 7: record->price = atof(field); break;
        case 8: record->quantity = atoi(field); break;
        case 9: strncpy(record->date, field, 11); record->date[11] = '\0'; break;
        case 10: record->score1 = atof(field); break;
        case 11: record->score2 = atof(field); break;
        case 12: record->score3 = atof(field); break;
        case 13: record->priority = atoi(field); break;
        case 14: strncpy(record->description, field, 63); record->description[63] = '\0'; break;
        case 15: record->weight = atof(field); break;
        case 16: record->count = atoi(field); break;
        case 17: strncpy(record->type, field, 15); record->type[15] = '\0'; break;
        case 18: record->ratio = atof(field); break;
        case 19: record->flag = atoi(field); break;
    }
}

// Optimized CSV parser using direct buffer access
int parse_csv_string_optimized(const char* csv_str, CsvRecord* records, int max_records) {
    const char* ptr = csv_str;
    const char* end = csv_str + strlen(csv_str);
    int record_count = 0;
    bool skip_header = true;
    
    CsvRecord current_record = {0};
    char field_buffer[256];
    int field_pos = 0;
    int field_index = 0;
    bool in_quotes = false;
    
    while (ptr < end && record_count < max_records) {
        char c = *ptr;
        
        // Handle quotes (for fields that might contain commas)
        if (c == '"') {
            in_quotes = !in_quotes;
            ptr++;
            continue;
        }
        
        // Handle field separators and line endings
        if ((c == ',' && !in_quotes) || c == '\n' || c == '\r') {
            // Null-terminate current field
            field_buffer[field_pos] = '\0';
            
            // Process field if we're not skipping header
            if (!skip_header && field_index < 20) {
                process_csv_field(field_buffer, field_index, &current_record);
            }
            
            field_pos = 0;
            field_index++;
            
            // Handle end of line
            if (c == '\n' || c == '\r') {
                if (skip_header) {
                    skip_header = false;
                } else if (field_index >= 20 && current_record.id > 0) {
                    records[record_count++] = current_record;
                    current_record = {0};
                }
                field_index = 0;
                
                // Skip \r\n combinations
                if (c == '\r' && ptr + 1 < end && *(ptr + 1) == '\n') {
                    ptr++;
                }
            }
            
            ptr++;
            continue;
        }
        
        // Add character to current field
        if (field_pos < 255) {
            field_buffer[field_pos++] = c;
        }
        
        ptr++;
    }
    
    // Handle last record if file doesn't end with newline
    if (!skip_header && field_index >= 20 && current_record.id > 0) {
        field_buffer[field_pos] = '\0';
        process_csv_field(field_buffer, field_index, &current_record);
        records[record_count++] = current_record;
    }
    
    return record_count;
}

// Generate CSV data of specified size
EMSCRIPTEN_KEEPALIVE
char* generate_test_csv(int target_size_mb) {
    // Estimate records needed for target size (~250 bytes per record with 20 columns)
    int estimated_records = target_size_mb * 1024 * 1024 / 250;
    
    // Calculate buffer size needed (with some extra space)
    size_t buffer_size = target_size_mb * 1024 * 1024 + 1024; // Add 1KB extra
    
    // Allocate memory for the CSV string
    char* result = (char*)malloc(buffer_size);
    if (!result) {
        return nullptr;
    }
    
    // Generate CSV data directly into the buffer
    generate_csv_data_internal(estimated_records, result, buffer_size);
    
    return result;
}

// Parse CSV and return parsing statistics
EMSCRIPTEN_KEEPALIVE
double* parse_csv_data(const char* csv_str) {
    if (!csv_str) return nullptr;
    
    // Allocate memory for results: [record_count, total_size, avg_value, parse_time_ms]
    double* results = (double*)malloc(4 * sizeof(double));
    if (!results) return nullptr;
    
    // Measure parsing time using high resolution clock
    auto start_time = std::chrono::high_resolution_clock::now();
    
    // Allocate space for records
    int max_records = 250000; // Support up to 250k records
    CsvRecord* records = (CsvRecord*)malloc(max_records * sizeof(CsvRecord));
    if (!records) {
        free(results);
        return nullptr;
    }
    
    // Parse CSV using optimized parser
    int record_count = parse_csv_string_optimized(csv_str, records, max_records);
    
    auto end_time = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::microseconds>(end_time - start_time);
    double parse_time = duration.count() / 1000.0; // Convert to milliseconds
    
    // Calculate statistics
    double total_value = 0.0;
    for (int i = 0; i < record_count; i++) {
        total_value += records[i].value1 + records[i].value2 + records[i].value3;
    }
    double avg_value = (record_count > 0) ? total_value / (record_count * 3) : 0.0;
    
    // Store results
    results[0] = (double)record_count;
    results[1] = (double)strlen(csv_str);
    results[2] = avg_value;
    results[3] = parse_time;
    
    // Free records memory
    free(records);
    
    return results;
}

// Run complete CSV parsing test
EMSCRIPTEN_KEEPALIVE
double* run_csv_parser_test(int target_size_mb) {
    // Generate test data
    char* csv_data = generate_test_csv(target_size_mb);
    if (!csv_data) return nullptr;
    
    // Parse the data
    double* results = parse_csv_data(csv_data);
    
    // Free generated data
    free(csv_data);
    
    return results;
}

// Free memory allocated for CSV parser results
EMSCRIPTEN_KEEPALIVE
void free_csv_parser_data(double* data) {
    if (data) {
        free(data);
    }
}

// Free CSV string memory
EMSCRIPTEN_KEEPALIVE
void free_csv_string(char* csv_str) {
    if (csv_str) {
        free(csv_str);
    }
}

// Get estimated record count for target size
EMSCRIPTEN_KEEPALIVE
int get_estimated_csv_record_count(int target_size_mb) {
    return target_size_mb * 1024 * 1024 / 250; // ~250 bytes per record
}

} // extern "C"
