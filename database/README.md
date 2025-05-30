# 🗄️ Database Integration for WebAssembly Benchmark Suite

## 📋 Visão Geral

Este módulo implementa a integração completa com banco de dados PostgreSQL (Neon) para armazenar todos os resultados dos benchmarks de forma estruturada e consultável.

## 🏗️ Arquitetura do Banco

### 📊 Esquema do Banco

O banco de dados é estruturado para preservar **TODAS** as informações dos JSONs originais:

#### Tabelas Principais

1. **`environment_info`** - Informações do ambiente de execução
2. **`cpu_info`** - Detalhes dos processadores
3. **`test_runs`** - Execuções de testes principais
4. **`performance_stats`** - Estatísticas de performance (WASM e JS)
5. **`memory_measurements`** - Medições de memória por iteração
6. **`memory_stats`** - Estatísticas agregadas de memória
7. **`validation_results`** - Resultados de validação de correção

#### Views Úteis

- **`performance_comparison`** - Comparação side-by-side WASM vs JS
- **`algorithm_summary`** - Resumo de performance por algoritmo
- **`recent_benchmarks`** - Benchmarks recentes (últimos 7 dias)

## 🚀 Configuração Rápida

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Banco de Dados

```bash
# Testar conexão
npm run test-db

# Criar schema
npm run setup-db
```

### 3. Migrar Dados Existentes (Opcional)

```bash
# Migrar JSONs existentes para o banco
npm run migrate
```

### 4. Executar Benchmarks

```bash
# Executar com integração automática ao banco
npm test
```

## 🔧 Configuração Detalhada

### 📡 Conexão com Neon PostgreSQL

A conexão está configurada em `database/config.js`:

```javascript
const config = {
  connectionString: 'postgresql://neondb_owner:npg_N1mUPbenfQz7@ep-billowing-hat-a8napemv-pooler.eastus2.azure.neon.tech/neondb?sslmode=require',
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
};
```

### 🛠️ Scripts Disponíveis

```bash
# Testar conexão com banco
npm run test-db

# Configurar schema do banco
npm run setup-db

# Migrar dados existentes
npm run migrate

# Executar benchmarks (salva automaticamente no banco)
npm test

# Executar benchmark específico
npm run matrix
npm run fft
npm run integration
# etc...
```

## 📊 Uso da Integração

### 🔄 Salvamento Automático

Os benchmarks agora salvam automaticamente no banco:

```javascript
// TestRunnerWithDatabase salva automaticamente
const runner = TestRunnerWithDatabase.create(wasmModule, jsModule, 'Matrix Multiplication');
await runner.runCompleteBenchmark('Matrix Multiplication', ['small', 'medium', 'large']);
// ✅ Dados salvos automaticamente no PostgreSQL
```

### 📈 Consultas de Dados

```javascript
const runner = TestRunnerWithDatabase.create({}, {}, 'Query');

// Resultados recentes
const recent = await runner.getRecentResults(10);

// Resumo de performance
const summary = await runner.getPerformanceSummary();

await runner.cleanup();
```

### 🔍 Exemplos de Consultas SQL

```sql
-- Performance média por algoritmo
SELECT algorithm, size_category, AVG(speedup) as avg_speedup
FROM test_runs 
GROUP BY algorithm, size_category
ORDER BY avg_speedup DESC;

-- Tendência de performance ao longo do tempo
SELECT DATE(created_at) as date, algorithm, AVG(speedup) as avg_speedup
FROM test_runs 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), algorithm
ORDER BY date DESC;

-- Comparação detalhada WASM vs JS
SELECT * FROM performance_comparison 
WHERE algorithm = 'Matrix Multiplication'
ORDER BY created_at DESC;
```

## 🗂️ Estrutura dos Dados

### 📋 Informações Preservadas

Todas as informações dos JSONs originais são preservadas:

- ✅ **Ambiente**: OS, Node.js version, CPU details, memory
- ✅ **Performance**: All timing data, statistics (min/max/mean/std)
- ✅ **Memória**: Individual measurements + aggregated stats
- ✅ **Validação**: Success/failure + detailed discrepancies
- ✅ **Metadados**: Timestamps, iterations, speedup calculations

### 🔢 Exemplo de Dados Salvos

```json
{
  "test_run_id": 123,
  "algorithm": "Matrix Multiplication",
  "size_category": "medium",
  "speedup": 6.22,
  "wasm_mean_time": 156.23,
  "js_mean_time": 971.45,
  "validation_success": true,
  "created_at": "2025-05-28T14:00:48.214Z"
}
```

## 🔧 Manutenção

### 🧹 Limpeza de Dados

```sql
-- Remover testes mais antigos que 90 dias
DELETE FROM test_runs 
WHERE created_at < NOW() - INTERVAL '90 days';

-- Vacuum para recuperar espaço
VACUUM ANALYZE;
```

### 📊 Monitoramento

```sql
-- Contagem de testes por algoritmo
SELECT algorithm, COUNT(*) as test_count
FROM test_runs 
GROUP BY algorithm;

-- Tamanho das tabelas
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 🚨 Solução de Problemas

### ❌ Erro de Conexão

```
❌ Connection test failed: Connection refused
```

**Soluções:**
- Verificar conectividade de rede
- Confirmar credenciais do banco
- Testar conexão: `npm run test-db`

### ❌ Erro de Schema

```
❌ relation "test_runs" does not exist
```

**Soluções:**
- Executar setup do banco: `npm run setup-db`
- Verificar se as tabelas foram criadas

### ❌ Erro de Migração

```
❌ Migration failed: JSON parsing error
```

**Soluções:**
- Verificar integridade dos arquivos JSON
- Executar migração individual por arquivo
- Verificar logs detalhados

## 🔐 Segurança

### 🛡️ Boas Práticas

- ✅ Conexões SSL obrigatórias
- ✅ Credenciais em arquivos separados
- ✅ Transações para integridade dos dados
- ✅ Validação de entrada de dados
- ✅ Pool de conexões para performance

### 🔒 Configuração SSL

```javascript
ssl: {
  require: true,
  rejectUnauthorized: false  // Para Neon cloud
}
```

## 📈 Performance

### ⚡ Otimizações Implementadas

- **Indexes**: Em campos frequentemente consultados
- **Batch Inserts**: Para memory measurements
- **Connection Pooling**: Pool de conexões reutilizáveis
- **Transactions**: Garantem consistência
- **Views**: Consultas pré-otimizadas

### 📊 Benchmarks do Banco

Inserção típica (teste completo):
- **Environment Info**: ~1ms
- **CPU Info**: ~10ms (8 CPUs)
- **Test Results**: ~50ms (3 sizes × 10 iterations)
- **Total**: ~100ms por algoritmo

## 🎯 Roadmap

### 🚧 Melhorias Futuras

- [ ] **Dashboard Web**: Interface gráfica para visualização
- [ ] **API REST**: Endpoint para consulta externa
- [ ] **Análise Histórica**: Trends de performance
- [ ] **Alertas**: Notificações de regressão
- [ ] **Export/Import**: Backup e restore de dados
- [ ] **Clustering**: Análise de padrões nos dados

---

## 📞 Suporte

Para questões sobre a integração do banco de dados:

1. **Verificar logs**: Console output detalhado
2. **Testar conexão**: `npm run test-db`
3. **Verificar schema**: `npm run setup-db`
4. **Migração**: `npm run migrate`

**Logs úteis estão disponíveis durante a execução com emojis e cores para fácil identificação! 🎨** 