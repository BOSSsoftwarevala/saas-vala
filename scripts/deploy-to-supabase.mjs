#!/usr/bin/env node

/**
 * Deploy built frontend to Supabase Storage bucket
 * This script uploads the dist folder to the 'frontend' bucket in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://astmdnelnuqwpdbyzecr.supabase.co';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_ff53fe69f7488a48b893afc8475de0928f4cf38d';
const DIST_DIR = join(__dirname, '..', 'dist');
const BUCKET_NAME = 'frontend';

// Create Supabase client with access token for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_ACCESS_TOKEN);

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

/**
 * Upload a file to Supabase Storage
 */
async function uploadFile(filePath, storagePath) {
  try {
    const fileContent = readFileSync(filePath);
    const fileName = relative(DIST_DIR, filePath).replace(/\\/g, '/');
    
    console.log(`Uploading: ${fileName}`);
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileContent, {
        upsert: true,
        contentType: getContentType(fileName)
      });
    
    if (error) {
      console.error(`Error uploading ${fileName}:`, error);
      return false;
    }
    
    console.log(`✓ Uploaded: ${fileName}`);
    return true;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return false;
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const contentTypes = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'gif': 'image/gif',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'eot': 'application/vnd.ms-fontobject',
    'ico': 'image/x-icon'
  };
  
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Main deployment function
 */
async function deploy() {
  console.log('🚀 Starting deployment to Supabase Storage...');
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log(`Source: ${DIST_DIR}`);
  console.log('');
  
  try {
    // Get all files in dist directory
    const files = getAllFiles(DIST_DIR);
    console.log(`Found ${files.length} files to upload`);
    console.log('');
    
    let successCount = 0;
    let failCount = 0;
    
    // Upload each file
    for (const filePath of files) {
      const storagePath = relative(DIST_DIR, filePath).replace(/\\/g, '/');
      const success = await uploadFile(filePath, storagePath);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }
    
    console.log('');
    console.log('📊 Deployment Summary:');
    console.log(`✓ Success: ${successCount}`);
    console.log(`✗ Failed: ${failCount}`);
    console.log(`Total: ${files.length}`);
    
    if (failCount === 0) {
      console.log('');
      console.log('✅ Deployment completed successfully!');
      console.log(`🌐 Application is now available at: https://www.saasvala.com:8082`);
    } else {
      console.log('');
      console.log('⚠️ Deployment completed with errors');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

// Run deployment
deploy();
