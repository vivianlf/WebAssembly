-- WebAssembly Benchmark Suite Database Schema
-- Comprehensive schema to store all benchmark results with full JSON information

-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS test_runs CASCADE;
DROP TABLE IF EXISTS environment_info CASCADE;
DROP TABLE IF EXISTS cpu_info CASCADE;
DROP TABLE IF EXISTS benchmark_results CASCADE;
DROP TABLE IF EXISTS performance_stats CASCADE;
DROP TABLE IF EXISTS memory_measurements CASCADE;
DROP TABLE IF EXISTS validation_results CASCADE;

-- Environment information table
CREATE TABLE environment_info (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    algorithm VARCHAR(100) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    node_version VARCHAR(20) NOT NULL,
    platform_os VARCHAR(20) NOT NULL,
    architecture VARCHAR(10) NOT NULL,
    total_memory BIGINT NOT NULL,
    free_memory BIGINT NOT NULL,
    cpu_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- CPU information table (related to environment)
CREATE TABLE cpu_info (
    id SERIAL PRIMARY KEY,
    environment_id INTEGER REFERENCES environment_info(id) ON DELETE CASCADE,
    cpu_index INTEGER NOT NULL,
    model VARCHAR(200) NOT NULL,
    speed INTEGER NOT NULL,
    user_time BIGINT NOT NULL,
    nice_time BIGINT NOT NULL,
    sys_time BIGINT NOT NULL,
    idle_time BIGINT NOT NULL,
    irq_time BIGINT NOT NULL
);

-- Test runs table (main table for each test execution)
CREATE TABLE test_runs (
    id SERIAL PRIMARY KEY,
    environment_id INTEGER REFERENCES environment_info(id) ON DELETE CASCADE,
    algorithm VARCHAR(100) NOT NULL,
    algorithm_type VARCHAR(20) NOT NULL, -- 'math' or 'string'
    size_category VARCHAR(20) NOT NULL, -- 'small', 'medium', 'large'
    iterations_count INTEGER NOT NULL DEFAULT 10,
    speedup DECIMAL(10, 6) NOT NULL,
    validation_success BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Performance statistics for WASM and JS
CREATE TABLE performance_stats (
    id SERIAL PRIMARY KEY,
    test_run_id INTEGER REFERENCES test_runs(id) ON DELETE CASCADE,
    execution_type VARCHAR(10) NOT NULL, -- 'wasm' or 'js'
    min_time DECIMAL(15, 6) NOT NULL,
    max_time DECIMAL(15, 6) NOT NULL,
    mean_time DECIMAL(15, 6) NOT NULL,
    median_time DECIMAL(15, 6) NOT NULL,
    std_dev DECIMAL(15, 6) NOT NULL,
    p95_time DECIMAL(15, 6) NOT NULL,
    p99_time DECIMAL(15, 6) NOT NULL,
    -- Store individual timing results as JSON array
    individual_times JSONB NOT NULL
);

-- Memory measurements for each iteration
CREATE TABLE memory_measurements (
    id SERIAL PRIMARY KEY,
    test_run_id INTEGER REFERENCES test_runs(id) ON DELETE CASCADE,
    execution_type VARCHAR(10) NOT NULL, -- 'wasm' or 'js'
    iteration_index INTEGER NOT NULL,
    heap_used BIGINT NOT NULL,
    heap_total BIGINT NOT NULL,
    external_memory BIGINT NOT NULL,
    rss BIGINT NOT NULL
);

-- Memory statistics summary
CREATE TABLE memory_stats (
    id SERIAL PRIMARY KEY,
    test_run_id INTEGER REFERENCES test_runs(id) ON DELETE CASCADE,
    execution_type VARCHAR(10) NOT NULL, -- 'wasm' or 'js'
    min_heap BIGINT NOT NULL,
    max_heap BIGINT NOT NULL,
    mean_heap DECIMAL(15, 2) NOT NULL,
    median_heap DECIMAL(15, 2) NOT NULL,
    std_dev_heap DECIMAL(15, 2) NOT NULL,
    p95_heap BIGINT NOT NULL,
    p99_heap BIGINT NOT NULL,
    -- Detailed memory analysis as JSON
    memory_details JSONB NOT NULL
);

-- Validation results for correctness checking
CREATE TABLE validation_results (
    id SERIAL PRIMARY KEY,
    test_run_id INTEGER REFERENCES test_runs(id) ON DELETE CASCADE,
    success BOOLEAN NOT NULL,
    discrepancies JSONB NOT NULL, -- Array of discrepancy details
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX idx_test_runs_algorithm ON test_runs(algorithm);
CREATE INDEX idx_test_runs_timestamp ON test_runs(created_at);
CREATE INDEX idx_test_runs_algorithm_size ON test_runs(algorithm, size_category);
CREATE INDEX idx_environment_timestamp ON environment_info(timestamp);
CREATE INDEX idx_performance_stats_type ON performance_stats(execution_type);
CREATE INDEX idx_memory_measurements_type ON memory_measurements(execution_type);

-- Views for easy data access

-- Performance comparison view
CREATE VIEW performance_comparison AS
SELECT 
    tr.id as test_run_id,
    tr.algorithm,
    tr.algorithm_type,
    tr.size_category,
    tr.speedup,
    tr.created_at,
    wasm_stats.mean_time as wasm_mean_time,
    js_stats.mean_time as js_mean_time,
    wasm_stats.std_dev as wasm_std_dev,
    js_stats.std_dev as js_std_dev,
    ei.platform,
    ei.node_version
FROM test_runs tr
JOIN performance_stats wasm_stats ON tr.id = wasm_stats.test_run_id AND wasm_stats.execution_type = 'wasm'
JOIN performance_stats js_stats ON tr.id = js_stats.test_run_id AND js_stats.execution_type = 'js'
JOIN environment_info ei ON tr.environment_id = ei.id;

-- Algorithm performance summary view
CREATE VIEW algorithm_summary AS
SELECT 
    algorithm,
    algorithm_type,
    size_category,
    COUNT(*) as test_count,
    AVG(speedup) as avg_speedup,
    MIN(speedup) as min_speedup,
    MAX(speedup) as max_speedup,
    STDDEV(speedup) as speedup_std_dev
FROM test_runs
GROUP BY algorithm, algorithm_type, size_category
ORDER BY algorithm, size_category;

-- Recent benchmarks view
CREATE VIEW recent_benchmarks AS
SELECT 
    tr.algorithm,
    tr.size_category,
    tr.speedup,
    tr.validation_success,
    tr.created_at,
    ei.platform,
    ei.node_version
FROM test_runs tr
JOIN environment_info ei ON tr.environment_id = ei.id
WHERE tr.created_at >= (CURRENT_TIMESTAMP - INTERVAL '7 days')
ORDER BY tr.created_at DESC;

-- Comments for documentation
COMMENT ON TABLE environment_info IS 'Stores system environment information for each benchmark run';
COMMENT ON TABLE test_runs IS 'Main table storing benchmark test execution results';
COMMENT ON TABLE performance_stats IS 'Statistical analysis of performance timing results';
COMMENT ON TABLE memory_measurements IS 'Individual memory measurements for each test iteration';
COMMENT ON TABLE validation_results IS 'Results of correctness validation between WASM and JS implementations';

COMMENT ON COLUMN test_runs.speedup IS 'Performance speedup ratio (JS_time / WASM_time)';
COMMENT ON COLUMN performance_stats.individual_times IS 'JSON array of all individual timing measurements';
COMMENT ON COLUMN memory_stats.memory_details IS 'Detailed memory analysis including heap and external memory statistics'; 