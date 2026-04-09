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
  
  // Basic conversion - this is simplified, you may need to enhance it
  const blocks = [];
  
  // Split by paragraphs
  const paragraphs = html.split(/<\/p>|<br\s*\/?>/gi).filter(p => p.trim());
  
  for (let para of paragraphs) {
    // Clean up HTML tags for now (basic implementation)
    let text = para.replace(/<[^>]*>/g, '').trim();
    
    if (text) {
      blocks.push({
        _type: "block",
        style: "normal",
        children: [
          {
            _type: "span",
            text: text,
            marks: []
          }
        ]
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

// Prepare EmDash seed structure
const emdashSeed = {
  schema: {
    collections: [
      {
        name: "posts",
        label: "Posts",
        singularLabel: "Post",
        fields: [
          {
            name: "title",
            label: "Title",
            type: "string",
            required: true
          },
          {
            name: "slug",
            label: "Slug",
            type: "string",
            required: true,
            unique: true
          },
          {
            name: "content",
            label: "Content",
            type: "rich_text"
          },
          {
            name: "excerpt",
            label: "Excerpt",
            type: "text"
          },
          {
            name: "featured_image",
            label: "Featured Image",
            type: "image"
          },
          {
            name: "published_at",
            label: "Published At",
            type: "datetime"
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "draft", label: "Draft" },
              { value: "published", label: "Published" }
            ]
          },
          {
            name: "meta_title",
            label: "Meta Title",
            type: "string"
          },
          {
            name: "meta_description",
            label: "Meta Description",
            type: "text"
          }
        ]
      },
      {
        name: "pages",
        label: "Pages",
        singularLabel: "Page",
        fields: [
          {
            name: "title",
            label: "Title",
            type: "string",
            required: true
          },
          {
            name: "slug",
            label: "Slug",
            type: "string",
            required: true,
            unique: true
          },
          {
            name: "content",
            label: "Content",
            type: "rich_text"
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "draft", label: "Draft" },
              { value: "published", label: "Published" }
            ]
          }
        ]
      }
    ],
    taxonomies: [
      {
        name: "tags",
        label: "Tags",
        singularLabel: "Tag",
        collections: ["posts"]
      },
      {
        name: "category",
        label: "Categories",
        singularLabel: "Category",
        collections: ["posts"]
      }
    ]
  },
  content: {
    posts: [],
    pages: [],
    tags: [],
    category: []
  }
};

// Convert Ghost posts to EmDash format
if (ghostData.data.posts) {
  ghostData.data.posts.forEach((post, index) => {
    const emdashPost = {
      id: post.slug || `post-${index}`,
      title: post.title || 'Untitled',
      slug: post.slug || `post-${index}`,
      content: htmlToPortableText(post.html || post.plaintext || ''),
      excerpt: post.custom_excerpt || post.excerpt || '',
      status: post.status === 'published' ? 'published' : 'draft',
      published_at: convertDate(post.published_at),
      meta_title: post.meta_title || post.title,
      meta_description: post.meta_description || post.custom_excerpt || ''
    };
    
    // Add featured image if available
    if (post.feature_image) {
      emdashPost.featured_image = {
        src: post.feature_image,
        alt: post.feature_image_alt || post.title
      };
    }
    
    emdashSeed.content.posts.push(emdashPost);
  });
}

// Convert Ghost pages if any
if (ghostData.data.posts_pages) {
  ghostData.data.posts_pages.forEach((page, index) => {
    if (page.type === 'page') {
      const emdashPage = {
        id: page.slug || `page-${index}`,
        title: page.title || 'Untitled',
        slug: page.slug || `page-${index}`,
        content: htmlToPortableText(page.html || page.plaintext || ''),
        status: page.status === 'published' ? 'published' : 'draft'
      };
      
      emdashSeed.content.pages.push(emdashPage);
    }
  });
}

// Convert Ghost tags to EmDash taxonomy terms
if (ghostData.data.tags) {
  ghostData.data.tags.forEach((tag) => {
    emdashSeed.content.tags.push({
      id: tag.slug,
      name: tag.name,
      slug: tag.slug,
      description: tag.description || ''
    });
  });
}

// Add default category if none exist
if (emdashSeed.content.category.length === 0) {
  emdashSeed.content.category.push({
    id: 'general',
    name: 'General',
    slug: 'general',
    description: 'General content'
  });
}

// Write the migration seed file
const outputPath = path.join(__dirname, 'seed', 'ghost-migration.json');
fs.writeFileSync(outputPath, JSON.stringify(emdashSeed, null, 2));

console.log(`✅ Migration complete!`);
console.log(`📄 Created seed file: ${outputPath}`);
console.log(`\nMigration summary:`);
console.log(`  - Posts: ${emdashSeed.content.posts.length}`);
console.log(`  - Pages: ${emdashSeed.content.pages.length}`);
console.log(`  - Tags: ${emdashSeed.content.tags.length}`);
console.log(`\nTo import this content into EmDash, run:`);
console.log(`  npx emdash seed seed/ghost-migration.json`);