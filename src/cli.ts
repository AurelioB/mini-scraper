import process from 'node:process';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname, basename } from 'node:path';
import { program } from 'commander';
import debug from 'debug';
import glob from 'fast-glob';
import updateNotifier from 'update-notifier';
import { isRomFolder, scrapeFolder } from './libretro.js';
import { type Options } from './options.js';
import { checkOllama } from './ollama.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function run(args: string[] = process.argv) {
  const file = await fs.readFile(join(__dirname, '..', 'package.json'), 'utf8');
  const packageJson = JSON.parse(file);

  updateNotifier({ pkg: packageJson }).notify();

  if (args.includes('--verbose')) {
    debug.enable('*');
  }

  program
    .name(basename(process.argv[1]))
    .description(packageJson.description)
    .argument('<rompath>', 'Path to the folder containing the ROMs')
    .option('--width, -w <size>', 'Max width of the image', Number.parseFloat, 250)
    .option('--height, -h <size>', 'Max height of the image', Number.parseFloat)
    .option('--ai, -a', 'Use AI for advanced matching', false)
    .option('--ai-model, -m', 'Ollama model to use for AI matching', 'gemma2:2b')
    .option('--regions, -r <regions>', 'Preferred regions to use for AI matching', 'World,Europe,USA,Japan')
    .option('--force, -f', 'Force scraping over existing images')
    .option('--verbose', 'Show detailed logs')
    .version(packageJson.version, '-v, --version', 'Show current version')
    .helpCommand(false)
    .allowExcessArguments(false)
    .action(async (targetPath: string, options: Options) => {
      process.chdir(targetPath);
      const allFolders = await glob(['*'], { onlyDirectories: true });
      const romFolders = allFolders.filter(isRomFolder);

      if (romFolders.length === 0) {
        console.info('No ROM folders found');
        return;
      }

      const log = debug('cli');
      log('Found ROM folders:', romFolders);

      if (options.ai) {
        const ollama = await checkOllama(options.aiModel!);
        if (!ollama) {
          process.exitCode = 1;
          return;
        }
      }

      for (const folder of romFolders) {
        await scrapeFolder(folder, options);
      }
    });

  program.parse(args);
}
