#!/usr/bin/env node

const { runAllTestsHeavy, runAllTests } = require('./test/benchmark-suite');

async function autoBenchmark() {
    console.log('🎯 WebAssembly Auto-Benchmark Suite');
    console.log('📺 Running automatically for TV Box deployment');
    console.log('='.repeat(60));
    
    try {
        // Detectar argumentos de linha de comando
        const args = process.argv.slice(2);
        const isHeavy = args.includes('--heavy') || args.includes('-h');
        const isLight = args.includes('--light') || args.includes('-l');
        
        if (isHeavy) {
            console.log('🔬 Starting HEAVY benchmark (10 iterations each)...');
            console.log('⏱️  This will take longer but provides maximum accuracy');
            console.log('');
            await runAllTestsHeavy();
        } else if (isLight) {
            console.log('💡 Starting LIGHT benchmark (optimized iterations)...');
            console.log('⚡ Fast testing for quick results');
            console.log('');
            await runAllTests();
        } else {
            // Modo padrão: executar ambos
            console.log('🚀 Starting COMPLETE benchmark suite...');
            console.log('📊 Running both LIGHT and HEAVY tests for comprehensive analysis');
            console.log('');
            
            console.log('🔥 Phase 1: LIGHT Testing (Fast Results)');
            console.log('='.repeat(40));
            await runAllTests();
            
            console.log('\n' + '='.repeat(60));
            console.log('🔬 Phase 2: HEAVY Testing (Scientific Accuracy)');
            console.log('='.repeat(40));
            await runAllTestsHeavy();
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 Auto-benchmark completed successfully!');
        console.log('📊 All results saved to database and JSON files');
        console.log('📺 TV Box benchmark execution finished');
        
    } catch (error) {
        console.error('❌ Auto-benchmark failed:', error.message);
        console.error('📋 Stack trace:', error.stack);
        process.exit(1);
    }
}

// Executar automaticamente quando o script for chamado diretamente
if (require.main === module) {
    autoBenchmark().then(() => {
        console.log('\n✨ Benchmark suite completed. Exiting...');
        process.exit(0);
    }).catch(error => {
        console.error('💥 Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = { autoBenchmark }; 