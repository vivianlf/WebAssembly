#!/usr/bin/env node

const readline = require('readline');
const path = require('path');

// Função para pausar e aguardar input do usuário
function waitForUserInput(message = '\nPressione ENTER para sair...') {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question(message, () => {
            rl.close();
            resolve();
        });
    });
}

async function runBenchmarkSuite() {
    console.log('🎯 WebAssembly vs JavaScript Benchmark Suite');
    console.log('📊 Interactive Benchmark Tool');
    console.log('='.repeat(60));
    
    try {
        // Verificar se os arquivos WASM existem
        const fs = require('fs');
        const wasmFiles = [
            'build/node/matrix-multiply.wasm',
            'build/node/fft.wasm',
            'build/node/numeric-integration.wasm',
            'build/node/gradient-descent.wasm',
            'build/node/json-parser.wasm',
            'build/node/csv-parser.wasm'
        ];
        
        console.log('🔍 Verificando arquivos WebAssembly...');
        let missingFiles = [];
        
        for (const file of wasmFiles) {
            if (!fs.existsSync(file)) {
                missingFiles.push(file);
            } else {
                console.log(`✅ ${file} encontrado`);
            }
        }
        
        if (missingFiles.length > 0) {
            console.error('❌ Arquivos WASM não encontrados:');
            missingFiles.forEach(file => console.error(`   - ${file}`));
            await waitForUserInput('\nPressione ENTER para continuar mesmo assim...');
        }
        
        console.log('\n🚀 Iniciando benchmark suite...\n');
        
        // Importar e executar o benchmark suite
        const benchmarkSuite = require('./test/benchmark-suite.js');
        
        // O benchmark-suite.js já tem sua própria interface interativa
        // Não precisamos fazer nada mais aqui, apenas aguardar
        
    } catch (error) {
        console.error('❌ Erro ao executar benchmark suite:', error.message);
        console.error('📋 Stack trace:', error.stack);
        
        // Pausar para mostrar o erro
        await waitForUserInput('\nPressione ENTER para sair (erro ocorreu)...');
        process.exit(1);
    }
}

// Tratamento de sinais
process.on('SIGINT', async () => {
    console.log('\n\n👋 Interrompido pelo usuário');
    await waitForUserInput('Pressione ENTER para sair...');
    process.exit(0);
});

process.on('uncaughtException', async (error) => {
    console.error('\n💥 Erro não capturado:', error.message);
    console.error('Stack:', error.stack);
    await waitForUserInput('\nPressione ENTER para sair (erro fatal)...');
    process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('\n💥 Promise rejeitada não tratada:', reason);
    await waitForUserInput('\nPressione ENTER para sair (promise rejeitada)...');
    process.exit(1);
});

// Executar apenas se for o arquivo principal
if (require.main === module) {
    runBenchmarkSuite().catch(async (error) => {
        console.error('💥 Erro fatal no wrapper:', error.message);
        await waitForUserInput('\nPressione ENTER para sair (erro no wrapper)...');
        process.exit(1);
    });
}

module.exports = { runBenchmarkSuite }; 