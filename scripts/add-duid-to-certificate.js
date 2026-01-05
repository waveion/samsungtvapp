const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rootDir = path.resolve(__dirname, '..');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

console.log('========================================');
console.log('Add Device DUID to Tizen Certificate');
console.log('========================================\n');

(async () => {
  try {
    // Check if .tv-duids.json exists
    const duidFile = path.resolve(rootDir, '.tv-duids.json');
    let savedDuids = null;

    if (fs.existsSync(duidFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(duidFile, 'utf-8'));
        savedDuids = data.devices;
        console.log('✓ Found saved TV DUIDs:\n');
        savedDuids.forEach((device, index) => {
          console.log(`  [${index + 1}] ${device.model || 'Unknown Model'}`);
          console.log(`      IP: ${device.ip}`);
          console.log(`      DUID: ${device.duid}\n`);
        });
      } catch (error) {
        console.warn('⚠️  Could not read .tv-duids.json\n');
      }
    } else {
      console.log('⚠️  No saved DUIDs found. Run: npm run get-tv-duid\n');
    }

    // Get certificate profile name
    const profileName = await question('Enter certificate profile name [TizenProfile]: ') || 'TizenProfile';
    
    // Check if profile exists
    try {
      const profiles = execSync('tizen security-profiles list', { encoding: 'utf-8' });
      if (!profiles.includes(profileName)) {
        console.log(`\n⚠️  Profile "${profileName}" not found.`);
        const create = await question('Create new certificate profile? (y/n): ');
        
        if (create.toLowerCase() === 'y') {
          console.log('\n📝 Creating new certificate profile...\n');
          
          const password = await question('Enter password for certificate: ');
          const country = await question('Country (e.g., US): ') || 'US';
          const state = await question('State (e.g., California): ') || 'California';
          const city = await question('City (e.g., San Francisco): ') || 'San Francisco';
          const org = await question('Organization: ') || 'PAN METRO CONVERGENCE';
          const unit = await question('Unit (e.g., Dev Team): ') || 'Development';
          const name = await question('Your Name: ') || 'Developer';
          const email = await question('Email: ') || 'dev@example.com';

          const certCmd = `tizen certificate -a ${profileName} -p ${password} ` +
                         `-c ${country} -s "${state}" -ct "${city}" -o "${org}" ` +
                         `-u "${unit}" -n "${name}" -e ${email}`;
          
          try {
            execSync(certCmd, { stdio: 'inherit' });
            console.log('\n✅ Certificate created successfully!\n');
          } catch (error) {
            console.error('\n❌ Failed to create certificate');
            process.exit(1);
          }
        } else {
          console.log('\n❌ Aborted. Create certificate first or use existing profile.\n');
          process.exit(1);
        }
      } else {
        console.log(`\n✓ Profile "${profileName}" found.\n`);
      }
    } catch (error) {
      console.error('❌ Error checking profiles:', error.message);
      process.exit(1);
    }

    // Get DUIDs to add
    let duidsToAdd = [];

    if (savedDuids && savedDuids.length > 0) {
      const useAll = await question('Add all saved DUIDs? (y/n): ');
      
      if (useAll.toLowerCase() === 'y') {
        duidsToAdd = savedDuids.map(d => d.duid);
      } else {
        const indices = await question('Enter device numbers to add (e.g., 1,2): ');
        const selected = indices.split(',').map(i => parseInt(i.trim()) - 1);
        duidsToAdd = selected
          .filter(i => i >= 0 && i < savedDuids.length)
          .map(i => savedDuids[i].duid);
      }
    }

    // Option to add manual DUID
    const addManual = await question('\nAdd additional DUID manually? (y/n): ');
    if (addManual.toLowerCase() === 'y') {
      const manualDuid = await question('Enter DUID: ');
      if (manualDuid.trim()) {
        duidsToAdd.push(manualDuid.trim());
      }
    }

    if (duidsToAdd.length === 0) {
      console.log('\n❌ No DUIDs to add. Aborted.\n');
      process.exit(1);
    }

    console.log(`\n✓ Adding ${duidsToAdd.length} device(s) to certificate...\n`);

    const password = await question('Enter certificate password: ');

    // Add each DUID
    let successCount = 0;
    for (const duid of duidsToAdd) {
      try {
        console.log(`  Adding DUID: ${duid}...`);
        const addCmd = `tizen certificate -a ${profileName} -p ${password} --duid ${duid}`;
        execSync(addCmd, { stdio: 'pipe' });
        console.log(`  ✅ Added successfully\n`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ Failed to add ${duid}`);
        console.error(`     ${error.message}\n`);
      }
    }

    console.log('========================================');
    if (successCount === duidsToAdd.length) {
      console.log(`✅ All ${successCount} device(s) added successfully!`);
    } else {
      console.log(`⚠️  Added ${successCount} of ${duidsToAdd.length} device(s)`);
    }
    console.log('========================================\n');

    console.log('Next steps:');
    console.log('  1. Build: npm run build:tizen');
    console.log('  2. Package (signed): npm run package:tizen:signed');
    console.log('  3. Install: npm run install:tizen\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
})();

