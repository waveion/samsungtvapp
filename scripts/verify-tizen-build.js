const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('Verifying Tizen Build Compatibility');
console.log('========================================\n');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

let errors = 0;
let warnings = 0;

// Check 1: Dist folder exists
console.log('✓ Checking build output...');
if (!fs.existsSync(distDir)) {
  console.error('❌ dist/ folder not found. Run "npm run build:tizen" first.');
  process.exit(1);
}

// Check 2: Required files
console.log('✓ Checking required files...');
const requiredFiles = [
  { path: path.join(distDir, 'index.html'), name: 'index.html' },
  { path: path.join(distDir, 'config.xml'), name: 'config.xml' },
  { path: path.join(distDir, 'icon.png'), name: 'icon.png' },
  { path: path.join(distDir, 'tizen.js'), name: 'tizen.js' }
];

requiredFiles.forEach(file => {
  if (fs.existsSync(file.path)) {
    console.log(`  ✓ ${file.name}`);
  } else {
    console.error(`  ❌ ${file.name} - MISSING`);
    errors++;
  }
});

// Check 3: config.xml validation
console.log('\n✓ Validating config.xml...');
try {
  const configPath = path.join(distDir, 'config.xml');
  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    
    // Check for required elements
    const checks = [
      { pattern: /<widget.*id=".*"/, name: 'Widget ID' },
      { pattern: /<tizen:application.*id=".*"/, name: 'Application ID' },
      { pattern: /<content src=".*"/, name: 'Content source' },
      { pattern: /<icon src=".*"/, name: 'Icon source' },
      { pattern: /<name>.*<\/name>/, name: 'App name' },
      { pattern: /<tizen:profile name="tv"/, name: 'TV profile' },
      { pattern: /required_version="6\.0"/, name: 'Minimum version (6.0)' }
    ];
    
    checks.forEach(check => {
      if (check.pattern.test(configContent)) {
        console.log(`  ✓ ${check.name}`);
      } else {
        console.warn(`  ⚠️  ${check.name} - Not found or incorrect`);
        warnings++;
      }
    });
  }
} catch (error) {
  console.error(`  ❌ Failed to validate config.xml: ${error.message}`);
  errors++;
}

// Check 4: index.html validation
console.log('\n✓ Checking index.html...');
try {
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    
    if (indexContent.includes('$WEBAPIS/webapis/webapis.js')) {
      console.log('  ✓ Tizen Web APIs loaded');
    } else {
      console.warn('  ⚠️  Tizen Web APIs script not found');
      warnings++;
    }
    
    if (indexContent.includes('tizen.js')) {
      console.log('  ✓ Custom Tizen helper loaded');
    } else {
      console.warn('  ⚠️  Custom Tizen helper not loaded');
      warnings++;
    }
    
    if (indexContent.includes('<div id="root">')) {
      console.log('  ✓ React root element present');
    } else {
      console.error('  ❌ React root element missing');
      errors++;
    }
  }
} catch (error) {
  console.error(`  ❌ Failed to check index.html: ${error.message}`);
  errors++;
}

// Check 5: Bundle files (now with code splitting)
console.log('\n✓ Checking bundle files...');
const jsFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));
const cssFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.css'));

if (jsFiles.length > 0) {
  console.log(`  ✓ Found ${jsFiles.length} JavaScript chunk(s)`);
  
  // Check for runtime chunk (critical)
  const runtimeChunk = jsFiles.find(f => f.startsWith('runtime'));
  if (runtimeChunk) {
    console.log(`  ✓ Runtime chunk present: ${runtimeChunk}`);
  } else {
    console.warn('  ⚠️  Runtime chunk not found');
    warnings++;
  }
  
  // Check for main chunks
  const mainChunks = jsFiles.filter(f => f.includes('main'));
  if (mainChunks.length > 0) {
    console.log(`  ✓ Main chunk(s) present: ${mainChunks.length}`);
  } else {
    console.error('  ❌ No main chunks found');
    errors++;
  }
} else {
  console.error('  ❌ No JavaScript files found');
  errors++;
}

if (cssFiles.length > 0) {
  console.log(`  ✓ Found ${cssFiles.length} CSS chunk(s)`);
} else {
  console.warn('  ⚠️  No CSS files found');
  warnings++;
}

// Check 6: Bundle size
console.log('\n✓ Checking bundle size...');
try {
  const getDirectorySize = (dirPath) => {
    let totalSize = 0;
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        totalSize += getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    });
    
    return totalSize;
  };
  
  const totalSize = getDirectorySize(distDir);
  const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
  
  console.log(`  📦 Total build size: ${sizeMB} MB`);
  
  if (totalSize > 50 * 1024 * 1024) {
    console.warn('  ⚠️  Build size is large (>50MB). Consider optimization.');
    warnings++;
  } else if (totalSize > 100 * 1024 * 1024) {
    console.error('  ❌ Build size too large (>100MB). Optimization required.');
    errors++;
  } else {
    console.log('  ✓ Build size is acceptable');
  }
} catch (error) {
  console.warn(`  ⚠️  Could not calculate build size: ${error.message}`);
  warnings++;
}

// Check 7: Tizen compatibility
console.log('\n✓ Checking Tizen compatibility...');
try {
  // Check main chunks for ES5 compatibility
  const mainChunks = fs.readdirSync(distDir).filter(f => f.includes('main') && f.endsWith('.js'));
  
  if (mainChunks.length > 0) {
    const sampleChunk = path.join(distDir, mainChunks[0]);
    const content = fs.readFileSync(sampleChunk, 'utf-8');
    
    // Check that bundle is transpiled (should use var, not let/const at top level)
    const firstLines = content.substring(0, 1000);
    if (firstLines.includes('!function(') || firstLines.includes('var ') || firstLines.includes('function(')) {
      console.log('  ✓ Chunks appear to be transpiled to ES5');
    } else {
      console.warn('  ⚠️  Chunk format unclear - manual testing recommended');
      warnings++;
    }
    
    // Check bundle starts with ES5 compatibility banner
    if (content.includes('ES5 Compatible')) {
      console.log('  ✓ ES5 compatibility banner present');
    } else {
      console.warn('  ⚠️  ES5 compatibility banner not found (may be in runtime chunk)');
      warnings++;
    }
  } else {
    console.warn('  ⚠️  No main chunks found to verify');
    warnings++;
  }
} catch (error) {
  console.warn(`  ⚠️  Could not verify compatibility: ${error.message}`);
  warnings++;
}

// Summary
console.log('\n========================================');
console.log('Verification Summary');
console.log('========================================');

if (errors === 0 && warnings === 0) {
  console.log('✅ All checks passed! Build is ready for packaging.');
  console.log('\nNext steps:');
  console.log('  1. npm run package:tizen');
  console.log('  2. npm run install:tizen');
  console.log('========================================\n');
  process.exit(0);
} else {
  if (errors > 0) {
    console.error(`❌ Found ${errors} error(s)`);
  }
  if (warnings > 0) {
    console.warn(`⚠️  Found ${warnings} warning(s)`);
  }
  
  console.log('\nPlease fix the errors before packaging.');
  console.log('========================================\n');
  
  if (errors > 0) {
    process.exit(1);
  } else {
    console.log('⚠️  Warnings detected, but build can proceed.');
    process.exit(0);
  }
}

