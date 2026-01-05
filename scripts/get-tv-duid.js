const { execSync } = require('child_process');

/**
 * Get DUID from connected Samsung TV
 * DUID is required to add device to certificate for production builds
 */

console.log('========================================');
console.log('Getting TV Device DUID');
console.log('========================================\n');

try {
  // Check if SDB is available
  try {
    execSync('sdb version', { stdio: 'ignore' });
  } catch (error) {
    console.error('❌ Error: SDB (Samsung Debug Bridge) not found.');
    console.error('   Please install Tizen Studio and add SDB to PATH.\n');
    console.error('   PATH: ~/tizen-studio/tools or C:\\tizen-studio\\tools\n');
    process.exit(1);
  }

  // Get connected devices
  console.log('✓ Checking for connected devices...\n');
  const devicesOutput = execSync('sdb devices -l', { encoding: 'utf-8' });
  
  console.log('Connected Devices:');
  console.log('------------------');
  console.log(devicesOutput);
  console.log('------------------\n');

  // Parse devices
  const lines = devicesOutput.split('\n').filter(line => line.trim() && !line.includes('List of devices'));
  
  if (lines.length === 0) {
    console.error('❌ No devices connected.');
    console.error('\nTo connect your TV:');
    console.error('  1. Enable Developer Mode on TV (press 12345 in Apps)');
    console.error('  2. Get TV IP address (Settings → Network → Network Status)');
    console.error('  3. Run: sdb connect <TV_IP_ADDRESS>\n');
    process.exit(1);
  }

  // Extract DUIDs
  const devices = [];
  lines.forEach((line, index) => {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 3) {
      const ip = parts[0];
      const status = parts[1];
      const model = parts.slice(2).join(' ');
      
      // Get DUID using capability command
      try {
        const capOutput = execSync(`sdb -s ${ip} capability`, { encoding: 'utf-8' });
        const duidMatch = capOutput.match(/device_id:([A-Za-z0-9-]+)/i) || 
                         capOutput.match(/duid:([A-Za-z0-9-]+)/i);
        
        if (duidMatch && duidMatch[1]) {
          devices.push({
            index: index + 1,
            ip,
            status,
            model,
            duid: duidMatch[1]
          });
        }
      } catch (error) {
        console.warn(`⚠️  Could not get DUID for ${ip}`);
      }
    }
  });

  if (devices.length === 0) {
    console.error('❌ Could not retrieve DUID from connected devices.');
    console.error('\nAlternative: Get DUID manually from TV:');
    console.error('  TV Settings → Support → About This TV → Device ID\n');
    process.exit(1);
  }

  // Display devices with DUIDs
  console.log('✅ Found Device(s) with DUID:\n');
  devices.forEach(device => {
    console.log(`Device ${device.index}:`);
    console.log(`  IP:     ${device.ip}`);
    console.log(`  Model:  ${device.model}`);
    console.log(`  Status: ${device.status}`);
    console.log(`  DUID:   ${device.duid}`);
    console.log('');
  });

  // Save DUIDs to file
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, '..');
  const duidFile = path.resolve(rootDir, '.tv-duids.json');

  const duidData = {
    timestamp: new Date().toISOString(),
    devices: devices.map(d => ({
      ip: d.ip,
      model: d.model,
      duid: d.duid
    }))
  };

  fs.writeFileSync(duidFile, JSON.stringify(duidData, null, 2));
  console.log(`✓ DUIDs saved to: .tv-duids.json\n`);

  // Instructions for adding to certificate
  console.log('========================================');
  console.log('Next Steps: Add DUID to Certificate');
  console.log('========================================\n');
  
  devices.forEach(device => {
    console.log(`For ${device.model} (${device.ip}):`);
    console.log(`\n  tizen certificate \\`);
    console.log(`    -a TizenProfile \\`);
    console.log(`    -p YourPassword \\`);
    console.log(`    --duid ${device.duid}\n`);
  });

  console.log('Or add multiple devices:');
  const allDuids = devices.map(d => d.duid).join(',');
  console.log(`\n  tizen certificate \\`);
  console.log(`    -a TizenProfile \\`);
  console.log(`    -p YourPassword \\`);
  console.log(`    --duid ${allDuids}\n`);

  console.log('Tip: Save your password! You\'ll need it for packaging.\n');
  console.log('========================================\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('\nTroubleshooting:');
  console.error('  1. Ensure TV is connected: sdb devices');
  console.error('  2. Check SDB is in PATH: sdb version');
  console.error('  3. Enable Developer Mode on TV\n');
  process.exit(1);
}

