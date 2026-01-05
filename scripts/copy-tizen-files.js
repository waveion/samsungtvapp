const fs = require('fs');
const path = require('path');

// Copy config.xml and required assets to dist folder
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

console.log('========================================');
console.log('Copying Tizen-specific files to dist...');
console.log('========================================\n');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('❌ Error: dist folder not found. Run "npm run build" first.');
  process.exit(1);
}

// List of files to copy
const filesToCopy = [
  {
    src: path.resolve(rootDir, 'config.xml'),
    dest: path.resolve(distDir, 'config.xml'),
    required: true,
    description: 'Tizen configuration file'
  },
  {
    src: path.resolve(rootDir, 'public', 'icon.png'),
    dest: path.resolve(distDir, 'icon.png'),
    required: false,
    description: 'Application icon'
  },
  {
    src: path.resolve(rootDir, 'public', 'tizen.js'),
    dest: path.resolve(distDir, 'tizen.js'),
    required: true,
    description: 'Tizen TV API helper'
  },
  {
    src: path.resolve(rootDir, 'public', 'webOSTV.js'),
    dest: path.resolve(distDir, 'webOSTV.js'),
    required: true,
    description: 'WebOS TV API helper'
  }
];

let hasErrors = false;

// Copy each file
filesToCopy.forEach(file => {
  if (fs.existsSync(file.src)) {
    try {
      fs.copyFileSync(file.src, file.dest);
      console.log(`✓ Copied ${path.basename(file.src)} (${file.description})`);
    } catch (error) {
      console.error(`❌ Failed to copy ${path.basename(file.src)}: ${error.message}`);
      if (file.required) hasErrors = true;
    }
  } else {
    if (file.required) {
      console.error(`❌ Required file not found: ${path.basename(file.src)}`);
      hasErrors = true;
    } else {
      console.warn(`⚠️  Optional file not found: ${path.basename(file.src)}`);
    }
  }
});

// Verify index.html exists
const indexPath = path.resolve(distDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('❌ index.html not found in dist folder');
  hasErrors = true;
}

if (hasErrors) {
  console.log('\n========================================');
  console.error('❌ Build failed: Missing required files');
  console.log('========================================');
  process.exit(1);
}

console.log('\n========================================');
console.log('✅ Tizen files copied successfully!');
console.log('========================================');
console.log('\nNext steps:');
console.log('  1. Package:  npm run package:tizen');
console.log('  2. Install:  npm run install:tizen');
console.log('  3. Run:      npm run run:tizen');
console.log('\nOr use the shortcut:');
console.log('  npm run deploy:tizen');
console.log('========================================\n');

