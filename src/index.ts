#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { replaceAndFormatComponents } from './replacer';

const program = new Command();

interface ProcessResult {
  filePath: string;
  content: string;
}

async function processFile(filePath: string): Promise<ProcessResult | null> {
  try {
    const code = await fs.readFile(filePath, 'utf-8');
    const newCode = await replaceAndFormatComponents(code);
    if (code !== newCode) {
      await fs.writeFile(filePath, newCode, 'utf-8');
      console.log(`Successfully processed: ${filePath}`);
      return { filePath, content: newCode };
    }
    return null;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Error processing ${filePath}:`, error.message);
    } else {
      console.error(`Unknown error processing ${filePath}`);
    }
    return null;
  }
}

async function processDirectory(dirPath: string): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...await processDirectory(fullPath));
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      const result = await processFile(fullPath);
      if (result) {
        results.push(result);
      }
    }
  }

  return results;
}

async function processPath(inputPath: string): Promise<ProcessResult[]> {
  const stats = await fs.stat(inputPath);
  if (stats.isDirectory()) {
    return processDirectory(inputPath);
  } else if (stats.isFile() && /\.(tsx?|jsx?)$/.test(inputPath)) {
    const result = await processFile(inputPath);
    return result ? [result] : [];
  } else {
    console.error(`Error: ${inputPath} is not a valid directory or TypeScript/JavaScript file.`);
    return [];
  }
}

program
  .name('component-replacer-cli')
  .description('CLI to replace and format React components in a file or directory')
  .version('1.0.0')
  .argument('<path>', 'The file or directory to process')
  .action(async (inputPath) => {
    try {
      const resolvedPath = path.resolve(inputPath);
      const results = await processPath(resolvedPath);
      
      console.log(`\nTotal files modified: ${results.length}`);
      
      if (results.length > 0) {
        console.log('\nModified files content:');
        results.forEach((result, index) => {
          // console.log(`\n--- File ${index + 1}: ${result.filePath} ---`);
          console.log(`\n--- File ${index + 1}: ${result.filePath} ---`);
          // console.log(result.content);
          console.log('--- End of file ---\n');
        });
      }
      
      console.log('All files processed successfully!');
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program.parse(process.argv);

