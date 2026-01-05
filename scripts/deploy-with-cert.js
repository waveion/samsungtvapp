const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const certFile = path.join(rootDir, 'author.p12');
const wgtFile = path.join(rootDir, 'PanMetroApp.wgt');

console.log('========================================');
console.log('🚀 Tizen Build & Deploy with Certificate');
console.log('========================================\n');

// Step 1: Check certificate
console.log('📋 Step 1: Checking certificate...');
if (!fs.existsSync(certFile)) {
  console.error('❌ Error: author.p12 certificate not found!');
  console.error('   Expected location:', certFile);
  process.exit(1);
}
console.log('✓ Certificate found:', certFile);

// Step 2: Check if tizen CLI is available
console.log('\n📋 Step 2: Checking Tizen CLI...');
try {
  execSync('tizen version', { stdio: 'pipe' });
  console.log('✓ Tizen CLI is available');
} catch (error) {
  console.error('❌ Error: Tizen CLI not found!');
  console.error('   Install Tizen Studio and add to PATH');
  console.error('   Visit: https://developer.tizen.org/development/tizen-studio/download');
  process.exit(1);
}

// Step 3: Build the application
console.log('\n📋 Step 3: Building application...');
try {
  execSync('npm run build:tizen', { stdio: 'inherit', cwd: rootDir });
  console.log('✓ Build completed successfully');
} catch (error) {
  console.error('❌ Build failed!');
  process.exit(1);
}

// Step 4: Check if dist folder exists
console.log('\n📋 Step 4: Verifying build output...');
if (!fs.existsSync(distDir)) {
  console.error('❌ Error: dist folder not found!');
  process.exit(1);
}
console.log('✓ Build output verified');

// Step 5: Package with certificate
console.log('\n📋 Step 5: Packaging with certificate...');
try {
  // Get the security profile name from Tizen
  const profilesPath = path.join(process.env.HOME, 'tizen-studio-data/profile/profiles.xml');
  let profileName = 'Panmetro'; // Default profile name
  
  if (fs.existsSync(profilesPath)) {
    const profilesContent = fs.readFileSync(profilesPath, 'utf-8');
    const match = profilesContent.match(/name="([^"]+)"/);
    if (match) {
      profileName = match[1];
      console.log(`   Using profile: ${profileName}`);
    }
  }
  
  // Remove old .wgt file if exists
  if (fs.existsSync(wgtFile)) {
    fs.unlinkSync(wgtFile);
    console.log('   Removed old package');
  }
  
  // Package with certificate
  const packageCmd = `tizen package -t wgt -s ${profileName} -- ${distDir}`;
  console.log(`   Command: ${packageCmd}`);
  execSync(packageCmd, { stdio: 'inherit', cwd: rootDir });
  
  // Move the .wgt file from dist to root
  const distWgt = path.join(distDir, 'PanMetroApp.wgt');
  if (fs.existsSync(distWgt)) {
    fs.renameSync(distWgt, wgtFile);
  }
  
  if (!fs.existsSync(wgtFile)) {
    console.error('❌ Package file not created!');
    process.exit(1);
  }
  
  const stats = fs.statSync(wgtFile);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`✓ Package created: PanMetroApp.wgt (${sizeMB} MB)`);
} catch (error) {
  console.error('❌ Packaging failed!');
  console.error(error.message);
  process.exit(1);
}

// Step 6: Check TV connection
console.log('\n📋 Step 6: Checking TV connection...');
try {
  const devices = execSync('sdb devices', { encoding: 'utf-8' });
  const lines = devices.split('\n').filter(line => line.trim() && !line.includes('List of devices'));
  
  if (lines.length === 0) {
    console.error('❌ No TV connected!');
    console.error('   Connect your TV:');
    console.error('   1. Enable Developer Mode on TV (press 12345 in Apps)');
    console.error('   2. Run: sdb connect <TV_IP>');
    process.exit(1);
  }
  
  console.log('✓ TV connected:', lines[0]);
} catch (error) {
  console.error('❌ Could not check TV connection');
  console.error('   Make sure sdb is installed and in PATH');
  process.exit(1);
}

// Step 7: Install on TV
console.log('\n📋 Step 7: Installing on TV...');
try {
  execSync(`tizen install -n ${wgtFile}`, { stdio: 'inherit', cwd: rootDir });
  console.log('✓ Installation successful!');
} catch (error) {
  console.error('❌ Installation failed!');
  console.error('   The package might already be installed.');
  console.error('   Try uninstalling first:');
  console.error('   tizen uninstall -p BtRWLGTTAm.PanMetroApp');
  process.exit(1);
}

// Step 8: Launch app
console.log('\n📋 Step 8: Launching app...');
try {
  execSync('tizen run -p BtRWLGTTAm.PanMetroApp', { stdio: 'inherit', cwd: rootDir });
  console.log('✓ App launched successfully!');
} catch (error) {
  console.warn('⚠️  Could not launch app automatically');
  console.warn('   Launch it manually from TV menu');
}

console.log('\n========================================');
console.log('✅ Deployment Complete!');
console.log('========================================');
console.log('📦 Package:', wgtFile);
console.log('📺 App ID: BtRWLGTTAm.PanMetroApp');
console.log('\n💡 Tips:');
console.log('   • View logs: sdb dlog | grep PanMetro');
console.log('   • Debug: sdb shell 0 debug BtRWLGTTAm.PanMetroApp');
console.log('   • Uninstall: tizen uninstall -p BtRWLGTTAm.PanMetroApp');
console.log('========================================\n');

