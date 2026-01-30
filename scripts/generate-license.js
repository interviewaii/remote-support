const { generateLicenseKey } = require('../src/utils/licenseManager');

const args = process.argv.slice(2);
const help = `
Usage: node generate-license.js --limit <5|10|15|50|100> --device <DEVICE_ID> [days]

Options:
  --limit   Screenshot limit (5, 10, 15, 50, 100)
  --device  Device ID (found in app settings)
  days      (Optional) Duration in days, default is 365
`;

// Simple arg parser
const getArg = (name) => {
    const index = args.indexOf(name);
    return index > -1 ? args[index + 1] : null;
};

const limit = getArg('--limit');
const deviceId = getArg('--device');
const days = parseInt(args[4]) || 365;

if (!limit || !deviceId) {
    console.log(help);
    process.exit(1);
}

// Map limit to tier code
const tierMap = {
    '5': 'LIM5',
    '10': 'NM10', // 4 chars required
    '15': 'NM15',
    '50': 'NM50',
    '100': 'N100'
};

const tierCode = tierMap[limit];
if (!tierCode) {
    console.error(`Invalid limit: ${limit}. Must be 5, 10, 15, 50, or 100.`);
    process.exit(1);
}

// Helper to mimic the simplified licenseManager used in Node
// (Since the original file uses ES6 modules which might not run directly in node without package.json "type": "module")
// So we'll duplicate the generation logic here for a standalone script to be safe
function generateKey(tier, devId, expiryDays) {
    const devHash = devId.substring(0, 8).toUpperCase();

    // Calculate expiry date
    const d = new Date();
    d.setDate(d.getDate() + expiryDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const expiry = `${year}${month}${day}`;

    const combined = `${tier}${devHash}${expiry}SECRET_SALT_2025`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const checksum = Math.abs(hash).toString(36).substring(0, 4).toUpperCase();

    return `${tier}-${devHash}-${expiry}-${checksum}`;
}

const key = generateKey(tierCode, deviceId, days);
console.log(`\n✅ License Key Generated for Device ${deviceId} (Limit: ${limit}):`);
console.log(`\n   ${key}\n`);
console.log(`   Tier Code: ${tierCode}`);
console.log(`   Expires in: ${days} days`);
