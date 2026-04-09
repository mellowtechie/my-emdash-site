#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Ghost export
const ghostExportPath = '/Users/toddm/mellowtechie-ghost/content/data/mellow-techie.ghost.2025-08-04-15-06-34.json';
const ghostData = JSON.parse(fs.readFileSync(ghostExportPath, 'utf-8'));

// Helper function to convert Ghost HTML to Portable Text
function htmlToPortableText(html) {
  if (!html) return [];
  
  const blocks = [];
  
  // Remove common wrapper tags
  html = html.replace(/<\/?div[^>]*>/gi, '');
  html = html.replace(/<\/?figure[^>]*>/gi, '');
  
  // Split by block-level elements
  const elements = html.split(/(?=<(?:p|h[1-6]|blockquote|ul|ol|li)[\s>])/gi);
  
  for (let element of elements) {
    element = element.trim();
    if (!element) continue;
    
    // Handle headings
    const headingMatch = element.match(/<h([1-6])[^>]*>(.*?)<\/h\1>/i);
    if (headingMatch) {
      const level = headingMatch[1];
      const text = headingMatch[2].replace(/<[^>]*>/g, '').trim();
      if (text) {
        blocks.push({
          _type: "block",
          style: `h${level}`,
          children: [{ _type: "span", text: text }]
        });
      }
      continue;
    }
    
    // Handle paragraphs
    const paraMatch = element.match(/<p[^>]*>(.*?)<\/p>/i);
    if (paraMatch) {
      const text = paraMatch[1].replace(/<[^>]*>/g, '').trim();
      if (text) {
        blocks.push({
          _type: "block",
          style: "normal",
          children: [{ _type: "span", text: text }]
        });
      }
      continue;
    }
    
    // Handle any remaining text
    const text = element.replace(/<[^>]*>/g, '').trim();
    if (text) {
      blocks.push({
        _type: "block",
        style: "normal",
        children: [{ _type: "span", text: text }]
      });
    }
  }
  
  return blocks;
}

// Helper function to convert Ghost date to ISO string
function convertDate(ghostDate) {
  if (!ghostDate) return new Date().toISOString();
  return new Date(ghostDate).toISOString();
}

// Prepare EmDash seed structure with proper format
const emdashSeed = {
  "$schema": "https://emdashcms.com/seed.schema.json",
  "version": "1",
  "meta": {
    "name": "Ghost Migration",
    "description": "Migrated content from Ghost CMS",
    "author": "Migration Script"
  },
  "settings": {
    "title": "Mellow Techie",
    "tagline": "Tech thoughts and musings"
  },
  "collections": [
    {
      "slug": "posts",
      "label": "Posts",
      "labelSingular": "Post",
      "supports": ["drafts", "revisions", "search", "seo"],
      "commentsEnabled": true,
      "fields": [
        {
          "slug": "title",
          "label": "Title",
          "type": "string",
          "required": true,
          "searchable": true
        },
        {
          "slug": "featured_image",
          "label": "Featured Image",
          "type": "image"
        },
        {
          "slug": "content",
          "label": "Content",
          "type": "portableText",
          "searchable": true
        },
        {
          "slug": "excerpt",
          "label": "Excerpt",
          "type": "text"
        }
      ]
    },
    {
      "slug": "pages",
      "label": "Pages",
      "labelSingular": "Page",
      "supports": ["drafts", "revisions", "search"],
      "fields": [
        {
          "slug": "title",
          "label": "Title",
          "type": "string",
          "required": true,
          "searchable": true
        },
        {
          "slug": "content",
          "label": "Content",
          "type": "portableText",
          "searchable": true
        }
      ]
    }
  ],
  "taxonomies": [],
  "bylines": [],
  "menus": [],
  "content": {
    "posts": [],
    "pages": []
  }
};

// Convert Ghost tags to EmDash taxonomies
const tags = new Map();
const categories = new Map();

if (ghostData.data.tags) {
  ghostData.data.tags.forEach((tag) => {
    tags.set(tag.id, {
      slug: tag.slug,
      label: tag.name
    });
  });
}

// Add taxonomies if we have tags
if (tags.size > 0) {
  emdashSeed.taxonomies.push({
    "name": "tag",
    "label": "Tags",
    "labelSingular": "Tag",
    "hierarchical": false,
    "collections": ["posts"],
    "terms": Array.from(tags.values())
  });
}

// Add a default category
emdashSeed.taxonomies.push({
  "name": "category",
  "label": "Categories",
  "labelSingular": "Category",
  "hierarchical": true,
  "collections": ["posts"],
  "terms": [
    { "slug": "general", "label": "General" }
  ]
});

// Convert Ghost posts to EmDash format
if (ghostData.data.posts) {
  ghostData.data.posts.forEach((post, index) => {
    const emdashPost = {
      id: `ghost-post-${index + 1}`,
      slug: post.slug || `post-${index + 1}`,
      status: post.status === 'published' ? 'published' : 'draft',
      data: {
        title: post.title || 'Untitled',
        content: htmlToPortableText(post.html || post.plaintext || ''),
        excerpt: post.custom_excerpt || post.excerpt || ''
      },
      taxonomies: {
        category: ["general"], // Default to general category
        tag: []
      }
    };
    
    // Add featured image if available
    if (post.feature_image) {
      emdashPost.data.featured_image = {
        "$media": {
          url: post.feature_image,
          alt: post.feature_image_alt || post.title,
          filename: post.feature_image ? path.basename(post.feature_image) : 'image.jpg'
        }
      };
    }
    
    // Add tags if the post has any
    if (post.tags && ghostData.data.posts_tags) {
      const postTags = ghostData.data.posts_tags
        .filter(pt => pt.post_id === post.id)
        .map(pt => {
          const tag = tags.get(pt.tag_id);
          return tag ? tag.slug : null;
        })
        .filter(Boolean);
      
      if (postTags.length > 0) {
        emdashPost.taxonomies.tag = postTags;
      }
    }
    
    emdashSeed.content.posts.push(emdashPost);
  });
}

// Convert Ghost pages if any
if (ghostData.data.posts) {
  ghostData.data.posts.forEach((page, index) => {
    if (page.type === 'page' || page.page === true) {
      const emdashPage = {
        id: `ghost-page-${index + 1}`,
        slug: page.slug || `page-${index + 1}`,
        status: page.status === 'published' ? 'published' : 'draft',
        data: {
          title: page.title || 'Untitled',
          content: htmlToPortableText(page.html || page.plaintext || '')
        }
      };
      
      emdashSeed.content.pages.push(emdashPage);
    }
  });
}

// Write the migration seed file
const outputPath = path.join(__dirname, 'seed', 'ghost-migration-v2.json');
fs.writeFileSync(outputPath, JSON.stringify(emdashSeed, null, 2));

console.log(`✅ Migration complete!`);
console.log(`📄 Created seed file: ${outputPath}`);
console.log(`\nMigration summary:`);
console.log(`  - Posts: ${emdashSeed.content.posts.length}`);
console.log(`  - Pages: ${emdashSeed.content.pages.length}`);
console.log(`  - Tags: ${tags.size}`);
console.log(`\nTo import this content into EmDash, run:`);
console.log(`  npx emdash seed seed/ghost-migration-v2.json`);