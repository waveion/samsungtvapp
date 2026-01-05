const { execSync } = require('child_process');

console.log('========================================');
console.log('🔍 Tizen TV App Debug Helper');
console.log('========================================\n');

console.log('Checking TV connection...');
try {
  const devices = execSync('sdb devices', { encoding: 'utf-8' });
  console.log(devices);
  
  const lines = devices.split('\n').filter(line => line.trim() && !line.includes('List of devices'));
  if (lines.length === 0) {
    console.error('❌ No TV connected! Run: sdb connect <TV_IP>');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ sdb not found or TV not connected');
  process.exit(1);
}

console.log('\n========================================');
console.log('📋 TV App Logs (Press Ctrl+C to stop)');
console.log('========================================\n');
console.log('Filtering for:');
console.log('  • PanMetro (app logs)');
console.log('  • ERROR/EXCEPTION (errors)');
console.log('  • ConsoleMessage (console.log)');
console.log('  • React (React errors)\n');

try {
  execSync('sdb dlog -c', { stdio: 'inherit' }); // Clear old logs
  console.log('Cleared old logs. Launching app...\n');
  
  try {
    execSync('tizen run -p BtRWLGTTAm.PanMetroApp', { stdio: 'pipe' });
  } catch (e) {
    // App might already be running
  }
  
  console.log('Showing live logs:\n');
  execSync('sdb dlog | grep -iE "(PanMetro|ERROR|EXCEPTION|ConsoleMessage|React|WARN.*JS)"', { stdio: 'inherit' });
} catch (error) {
  console.log('\nLog monitoring stopped');
}
