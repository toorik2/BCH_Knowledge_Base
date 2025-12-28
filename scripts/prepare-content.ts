/**
 * Content Preparation Script for xAI Collections
 *
 * Transforms BCH Knowledge Base content into optimized markdown files:
 * - Markdown docs → copied with flattened names
 * - FAQ JSONs → one markdown file per category
 */

import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { existsSync } from 'node:fs';

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = join(ROOT_DIR, 'prepared-content');

interface FAQ {
  q: string;
  a: string;
}

interface Category {
  name: string;
  faqs: FAQ[];
}

interface ChannelData {
  name: string;
  source: string;
  categories: Category[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function prepareDocs() {
  console.log('[Docs] Processing markdown documentation...');
  const docsDir = join(OUTPUT_DIR, 'docs');
  await mkdir(docsDir, { recursive: true });

  const docMappings = [
    { src: 'concepts/cashscript-mental-model.md', out: 'concepts-cashscript-mental-model.md' },
    { src: 'concepts/multi-contract-architecture.md', out: 'concepts-multi-contract-architecture.md' },
    { src: 'concepts/utxo-vs-account-model.md', out: 'concepts-utxo-vs-account-model.md' },
    { src: 'language/language-reference.md', out: 'language-reference.md' },
    { src: 'sdk/contracts/contract-instantiation.md', out: 'sdk-contract-instantiation.md' },
    { src: 'sdk/transactions/transaction-building.md', out: 'sdk-transaction-building.md' },
    { src: 'examples/real-world/production-patterns.md', out: 'examples-production-patterns.md' },
    { src: 'examples/real-world/parityusd-analysis.md', out: 'examples-parityusd-analysis.md' },
    { src: 'cashtokens/overview.md', out: 'cashtokens-overview.md' },
    { src: 'best-practices/security/smart-contract-security.md', out: 'best-practices-security.md' },
    { src: 'reference/quick-reference.md', out: 'reference-quick-reference.md' },
  ];

  let count = 0;
  for (const mapping of docMappings) {
    const srcPath = join(ROOT_DIR, mapping.src);
    if (existsSync(srcPath)) {
      const content = await readFile(srcPath, 'utf-8');
      await writeFile(join(docsDir, mapping.out), content);
      count++;
    } else {
      console.warn(`  [WARN] Missing: ${mapping.src}`);
    }
  }

  console.log(`[Docs] Copied ${count} documentation files`);
  return count;
}

async function prepareFAQ() {
  console.log('[FAQ] Processing FAQ JSON files...');
  const faqDir = join(OUTPUT_DIR, 'faq');
  await mkdir(faqDir, { recursive: true });

  const telegramDir = join(ROOT_DIR, 'faq/telegram');
  if (!existsSync(telegramDir)) {
    console.warn('[FAQ] No telegram directory found');
    return 0;
  }

  const files = await readdir(telegramDir);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  let totalCategories = 0;
  let totalFaqs = 0;

  for (const file of jsonFiles) {
    const filePath = join(telegramDir, file);
    const data: ChannelData = JSON.parse(await readFile(filePath, 'utf-8'));
    const channelSlug = slugify(data.name);

    for (const category of data.categories) {
      const categorySlug = slugify(category.name);
      const filename = `${channelSlug}-${categorySlug}.md`;

      let content = `# ${data.name}: ${category.name}\n\n`;
      content += `Source: ${data.source}\n\n`;
      content += `---\n\n`;

      for (const faq of category.faqs) {
        content += `## Q: ${faq.q}\n\n`;
        content += `**A:** ${faq.a}\n\n`;
        content += `---\n\n`;
        totalFaqs++;
      }

      await writeFile(join(faqDir, filename), content);
      totalCategories++;
    }
  }

  console.log(`[FAQ] Created ${totalCategories} category files (${totalFaqs} Q&As)`);
  return totalCategories;
}

async function main() {
  console.log('=== BCH Knowledge Base: Content Preparation ===\n');

  // Clean output directory
  if (existsSync(OUTPUT_DIR)) {
    await rm(OUTPUT_DIR, { recursive: true });
  }
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Process content
  const docCount = await prepareDocs();
  const faqCount = await prepareFAQ();

  const total = docCount + faqCount;
  console.log(`\n=== Complete: ${total} files ready for xAI ingestion ===`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
}

main().catch(console.error);
