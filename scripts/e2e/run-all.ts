import { runTier1 } from './tier1-features.js';
import { runTier2 } from './tier2-boundaries.js';
import { runTier3 } from './tier3-interactions.js';
import { runTier4 } from './tier4-scenarios.js';

interface CliOptions {
  tiers: number[];
  url?: string;
  bail: boolean;
  help: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    tiers: [1, 2, 3, 4],
    bail: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--tier=')) {
      const val = arg.split('=')[1];
      if (val === 'all') {
        options.tiers = [1, 2, 3, 4];
      } else {
        options.tiers = val.split(',').map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
      }
    } else if (arg.startsWith('--url=')) {
      options.url = arg.split('=')[1];
    } else if (arg === '--bail') {
      options.bail = true;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Canvio E2E Test Suite Runner

Usage:
  npx tsx scripts/e2e/run-all.ts [options]

Options:
  --tier=<list>      Comma-separated list of tiers to run (1, 2, 3, 4, or all) [default: all]
  --url=<url>        Target an existing running server URL (e.g. http://127.0.0.1:4001)
  --bail             Stop execution immediately if any tier experiences failures
  --help, -h         Show this help message

Examples:
  npx tsx scripts/e2e/run-all.ts
  npx tsx scripts/e2e/run-all.ts --tier=1
  npx tsx scripts/e2e/run-all.ts --tier=1,2 --bail
  npx tsx scripts/e2e/run-all.ts --url=http://127.0.0.1:4000
`);
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  console.log('===============================================================');
  console.log('            Canvio E2E Opaque-Box Test Runner                  ');
  console.log('===============================================================');
  console.log(`Target: ${options.url ? options.url : 'Ephemeral Supervised Instances'}`);
  console.log(`Selected Tiers: ${options.tiers.join(', ')}`);
  console.log(`Bail on failure: ${options.bail ? 'Yes' : 'No'}\n`);

  const startTime = Date.now();
  const executedTiers: { tier: number; status: 'PASSED' | 'FAILED'; error?: Error }[] = [];

  for (const tier of options.tiers) {
    console.log(`\n>>> Launching Tier ${tier}...`);
    try {
      if (tier === 1) {
        await runTier1(options.url);
      } else if (tier === 2) {
        await runTier2(options.url);
      } else if (tier === 3) {
        await runTier3(options.url);
      } else if (tier === 4) {
        await runTier4(options.url);
      } else {
        console.warn(`Unknown tier: ${tier}`);
        continue;
      }
      executedTiers.push({ tier, status: 'PASSED' });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`\n[!] Tier ${tier} encountered fatal failure: ${error.message}`);
      executedTiers.push({ tier, status: 'FAILED', error });
      if (options.bail) {
        console.error('\nBailing early due to failure (--bail enabled).');
        break;
      }
    }
  }

  const totalDuration = Date.now() - startTime;
  console.log('\n===============================================================');
  console.log('                     Final Test Summary                        ');
  console.log('===============================================================');
  executedTiers.forEach(({ tier, status, error }) => {
    const symbol = status === 'PASSED' ? '✓' : '✗';
    console.log(`  ${symbol} Tier ${tier}: ${status}${error ? ` (${error.message})` : ''}`);
  });
  console.log(`Total duration: ${(totalDuration / 1000).toFixed(2)}s\n`);

  const hasFailures = executedTiers.some((t) => t.status === 'FAILED');
  if (hasFailures) {
    process.exit(1);
  } else {
    console.log('All executed tiers completed successfully!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Master runner uncaught exception:', err);
  process.exit(1);
});
