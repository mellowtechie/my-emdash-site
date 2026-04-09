#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_TOKEN = 'ec_pat_ySiQU6KzqeDP_lZrTOaL_lW16-uM-4BkJHfDsnvL9Io';
const BASE_URL = 'https://my-emdash-site.mellow-techie.workers.dev';

async function pushContent() {
  try {
    // Read the seed file
    const seedPath = path.join(__dirname, 'seed', 'ghost-migration-v2.json');
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

    // First, check if collections exist
    const collectionsResponse = await fetch(`${BASE_URL}/_emdash/api/schema/collections`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!collectionsResponse.ok) {
      console.error('Failed to fetch collections:', collectionsResponse.status);
      return;
    }

    const collections = await collectionsResponse.json();
    console.log('Existing collections:', collections.data?.items?.map(c => c.slug));

    // Push content for each collection
    const content = seedData.content || {};
    
    for (const [collection, items] of Object.entries(content)) {
      if (!Array.isArray(items)) continue;
      
      console.log(`\nPushing ${items.length} items to ${collection}...`);
      
      for (const item of items) {
        console.log(`Creating ${collection}: ${item.slug}...`);

        const response = await fetch(`${BASE_URL}/_emdash/api/content/${collection}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(item)
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Created ${collection}: ${item.slug}`);
        } else {
          const error = await response.text();
          console.error(`❌ Failed to create ${collection} ${item.slug}:`, error);
        }
      }
    }

    // Verify the content was created
    const postsResponse = await fetch(`${BASE_URL}/_emdash/api/content/posts`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    if (postsResponse.ok) {
      const posts = await postsResponse.json();
      console.log(`\n✅ Successfully pushed ${posts.data.items.length} posts to remote!`);
      posts.data.items.forEach(post => {
        console.log(`  - ${post.title} (${post.slug})`);
      });
    }

  } catch (error) {
    console.error('Error pushing content:', error);
  }
}

pushContent();