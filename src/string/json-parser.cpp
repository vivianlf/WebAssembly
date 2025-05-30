#include <emscripten/emscripten.h>
#include <string>
#include <vector>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <chrono>

extern "C" {

// Simple JSON record structure
struct JsonRecord {
    int id;
    char name[64];
    double value;
    bool active;
};

// Generate synthetic JSON data (internal function, not exported)
void generate_json_data_internal(int num_records, char* buffer, size_t buffer_size) {
    size_t pos = 0;
    
    // Start JSON array
    pos += snprintf(buffer + pos, buffer_size - pos, "[\n");
    
    for (int i = 0; i < num_records && pos < buffer_size - 200; i++) {
        if (i > 0) {
            pos += snprintf(buffer + pos, buffer_size - pos, ",\n");
        }
        
        pos += snprintf(buffer + pos, buffer_size - pos,
            "  {\n"
            "    \"id\": %d,\n"
            "    \"name\": \"Record_%d\",\n"
            "    \"value\": %.5f,\n"
            "    \"active\": %s\n"
            "  }",
            i + 1,
            i + 1,
            (i + 1) * 3.14159,
            (i % 2 == 0) ? "true" : "false"
        );
    }
    
    // End JSON array
    pos += snprintf(buffer + pos, buffer_size - pos, "\n]");
}

// Optimized JSON parser using direct buffer access instead of string concatenation
int parse_json_string_optimized(const char* json_str, JsonRecord* records, int max_records) {
    const char* ptr = json_str;
    const char* end = json_str + strlen(json_str);
    int record_count = 0;
    JsonRecord current_record = {0};
    
    enum State { OUTSIDE, IN_ARRAY, IN_OBJECT, READING_KEY, EXPECTING_COLON, READING_VALUE };
    State state = OUTSIDE;
    
    char key_buffer[64];
    char value_buffer[256];
    int key_pos = 0;
    int value_pos = 0;
    bool in_string = false;
    bool escape_next = false;
    
    while (ptr < end && record_count < max_records) {
        char c = *ptr;
        
        if (escape_next) {
            escape_next = false;
            if (state == READING_KEY && key_pos < 63) key_buffer[key_pos++] = c;
            else if (state == READING_VALUE && value_pos < 255) value_buffer[value_pos++] = c;
            ptr++;
            continue;
        }
        
        if (c == '\\' && in_string) {
            escape_next = true;
            ptr++;
            continue;
        }
        
        if (c == '"') {
            in_string = !in_string;
            if (!in_string) {
                if (state == READING_KEY) {
                    key_buffer[key_pos] = '\0';
                    key_pos = 0;
                    state = EXPECTING_COLON;
                } else if (state == READING_VALUE) {
                    value_buffer[value_pos] = '\0';
                    value_pos = 0;
                    
                    // Process key-value pair immediately
                    if (strcmp(key_buffer, "name") == 0) {
                        strncpy(current_record.name, value_buffer, 63);
                        current_record.name[63] = '\0';
                    }
                    state = IN_OBJECT;
                }
            } else {
                if (state == IN_OBJECT) {
                    state = READING_KEY;
                } else if (state == EXPECTING_COLON) {
                    state = READING_VALUE;
                }
            }
            ptr++;
            continue;
        }
        
        if (in_string) {
            if (state == READING_KEY && key_pos < 63) {
                key_buffer[key_pos++] = c;
            } else if (state == READING_VALUE && value_pos < 255) {
                value_buffer[value_pos++] = c;
            }
            ptr++;
            continue;
        }
        
        // Skip whitespace
        if (c == ' ' || c == '\n' || c == '\t' || c == '\r') {
            ptr++;
            continue;
        }
        
        switch (c) {
            case '[':
                state = IN_ARRAY;
                break;
            case '{':
                state = IN_OBJECT;
                current_record = {0};
                break;
            case '}':
                // Process any remaining non-string value
                if (key_pos > 0 || value_pos > 0) {
                    value_buffer[value_pos] = '\0';
                    if (strcmp(key_buffer, "id") == 0) {
                        current_record.id = atoi(value_buffer);
                    } else if (strcmp(key_buffer, "value") == 0) {
                        current_record.value = atof(value_buffer);
                    } else if (strcmp(key_buffer, "active") == 0) {
                        current_record.active = (strcmp(value_buffer, "true") == 0);
                    }
                    key_pos = value_pos = 0;
                }
                state = IN_ARRAY;
                if (current_record.id > 0) {
                    records[record_count++] = current_record;
                    current_record = {0};
                }
                break;
            case ']':
                state = OUTSIDE;
                break;
            case ':':
                if (state == EXPECTING_COLON) {
                    state = READING_VALUE;
                    value_pos = 0;
                }
                break;
            case ',':
                // Process any remaining non-string value
                if (key_pos > 0 || value_pos > 0) {
                    value_buffer[value_pos] = '\0';
                    if (strcmp(key_buffer, "id") == 0) {
                        current_record.id = atoi(value_buffer);
                    } else if (strcmp(key_buffer, "value") == 0) {
                        current_record.value = atof(value_buffer);
                    } else if (strcmp(key_buffer, "active") == 0) {
                        current_record.active = (strcmp(value_buffer, "true") == 0);
                    }
                    key_pos = value_pos = 0;
                }
                if (state == IN_OBJECT || state == READING_VALUE) {
                    state = IN_OBJECT;
                }
                break;
            default:
                if (state == READING_VALUE && !in_string && value_pos < 255) {
                    value_buffer[value_pos++] = c;
                }
                break;
        }
        
        ptr++;
    }
    
    return record_count;
}

// Generate JSON data of specified size
EMSCRIPTEN_KEEPALIVE
char* generate_test_json(int target_size_mb) {
    // Estimate records needed for target size
    int estimated_records = target_size_mb * 1024 * 1024 / 120; // ~120 bytes per record
    
    // Calculate buffer size needed (with some extra space)
    size_t buffer_size = target_size_mb * 1024 * 1024 + 1024; // Add 1KB extra
    
    // Allocate memory for the JSON string
    char* result = (char*)malloc(buffer_size);
    if (!result) {
        return nullptr;
    }
    
    // Generate JSON data directly into the buffer
    generate_json_data_internal(estimated_records, result, buffer_size);
    
    return result;
}

// Parse JSON and return parsing statistics
EMSCRIPTEN_KEEPALIVE
double* parse_json_data(const char* json_str) {
    if (!json_str) return nullptr;
    
    // Allocate memory for results: [record_count, total_size, avg_value, parse_time_ms]
    double* results = (double*)malloc(4 * sizeof(double));
    if (!results) return nullptr;
    
    // Measure parsing time using high resolution clock
    auto start_time = std::chrono::high_resolution_clock::now();
    
    // Allocate space for records
    int max_records = 250000; // Support up to 250k records
    JsonRecord* records = (JsonRecord*)malloc(max_records * sizeof(JsonRecord));
    if (!records) {
        free(results);
        return nullptr;
    }
    
    // Parse JSON using optimized parser
    int record_count = parse_json_string_optimized(json_str, records, max_records);
    
    auto end_time = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::microseconds>(end_time - start_time);
    double parse_time = duration.count() / 1000.0; // Convert to milliseconds
    
    // Calculate statistics
    double total_value = 0.0;
    for (int i = 0; i < record_count; i++) {
        total_value += records[i].value;
    }
    double avg_value = (record_count > 0) ? total_value / record_count : 0.0;
    
    // Store results
    results[0] = (double)record_count;
    results[1] = (double)strlen(json_str);
    results[2] = avg_value;
    results[3] = parse_time;
    
    // Free records memory
    free(records);
    
    return results;
}

// Run complete JSON parsing test
EMSCRIPTEN_KEEPALIVE
double* run_json_parser_test(int target_size_mb) {
    // Generate test data
    char* json_data = generate_test_json(target_size_mb);
    if (!json_data) return nullptr;
    
    // Parse the data
    double* results = parse_json_data(json_data);
    
    // Free generated data
    free(json_data);
    
    return results;
}

// Free memory allocated for JSON parser results
EMSCRIPTEN_KEEPALIVE
void free_json_parser_data(double* data) {
    if (data) {
        free(data);
    }
}

// Free JSON string memory
EMSCRIPTEN_KEEPALIVE
void free_json_string(char* json_str) {
    if (json_str) {
        free(json_str);
    }
}

// Get estimated record count for target size
EMSCRIPTEN_KEEPALIVE
int get_estimated_record_count(int target_size_mb) {
    return target_size_mb * 1024 * 1024 / 120; // ~120 bytes per record
}

// Debug function to test parsing with simple JSON
EMSCRIPTEN_KEEPALIVE
double* debug_parse_simple() {
    const char* simple_json = R"([
  {
    "id": 1,
    "name": "Record_1",
    "value": 3.14159,
    "active": true
  },
  {
    "id": 2,
    "name": "Record_2",
    "value": 6.28318,
    "active": false
  }
])";
    
    // Allocate memory for results: [record_count, total_size, avg_value, parse_time_ms]
    double* results = (double*)malloc(4 * sizeof(double));
    if (!results) return nullptr;
    
    // Allocate space for records
    int max_records = 10;
    JsonRecord* records = (JsonRecord*)malloc(max_records * sizeof(JsonRecord));
    if (!records) {
        free(results);
        return nullptr;
    }
    
    // Parse JSON using optimized parser
    int record_count = parse_json_string_optimized(simple_json, records, max_records);
    
    // Calculate statistics
    double total_value = 0.0;
    for (int i = 0; i < record_count; i++) {
        total_value += records[i].value;
    }
    double avg_value = (record_count > 0) ? total_value / record_count : 0.0;
    
    // Store results
    results[0] = (double)record_count;
    results[1] = (double)strlen(simple_json);
    results[2] = avg_value;
    results[3] = 0.0; // no timing for debug
    
    // Free records memory
    free(records);
    
    return results;
}

} // extern "C"
