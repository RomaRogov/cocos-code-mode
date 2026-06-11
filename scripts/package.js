const fs = require('fs');
const path = require('path');
const { ZipWriter, BlobWriter, BlobReader } = require('@zip.js/zip.js');

// Read package.json to get the package name
const packageJsonPath = path.join(__dirname, '../package.json');
if (!fs.existsSync(packageJsonPath)) {
    console.error('package.json not found!');
    process.exit(1);
}

const packageJson = require(packageJsonPath);
const packageName = packageJson.name; // cocos-code-mode-ai
const zipFileName = `${packageName}.zip`;

// List of files/folders to include in the list
const filesToInclude = [
    '@types',
    'dist',
    'i18n',
    'node_modules',
    'static',
    'package-lock.json',
    'package.json',
    'README.md'
];

// Check for missing items (optional, but good for feedback)
const projectRoot = path.join(__dirname, '..');
const missingItems = filesToInclude.filter(item => !fs.existsSync(path.join(projectRoot, item)));

if (missingItems.length > 0) {
    console.warn('Warning: The following items to be packaged were not found:');
    missingItems.forEach(item => console.warn(` - ${item}`));
    // We proceed anyway, zip will just skip or fail depending on strictness, but usually it warns.
    // If 'dist' is missing, it's significant.
}

console.log(`Packaging project into ${zipFileName}...`);

// Try to use @zip.js/zip.js to create the archive programmatically.
async function createWithZipJS() {
    const zipPath = path.join(projectRoot, zipFileName);

    const writer = new ZipWriter(new BlobWriter('application/zip'));

    async function addFile(fullPath, entryName) {
        const data = fs.readFileSync(fullPath);
        const blob = new Blob([data]);
        await writer.add(entryName, new BlobReader(blob));
    }

    function walkAndAdd(dirPath, baseInZip) {
        const items = fs.readdirSync(dirPath);
        for (const name of items) {
            const full = path.join(dirPath, name);
            const rel = path.posix.join(baseInZip, name);
            const st = fs.statSync(full);
            if (st.isFile()) {
                // add file
                // we can't await in this loop, so push promises
                pendingAdds.push(addFile(full, rel));
            } else if (st.isDirectory()) {
                // ensure directory entry (optional)
                pendingAdds.push(writer.add(rel + '/', new BlobReader(new Blob([]))));
                walkAndAdd(full, rel);
            }
        }
    }

    const pendingAdds = [];

    for (const item of filesToInclude) {
        const abs = path.join(projectRoot, item);
        if (!fs.existsSync(abs)) continue;
        const st = fs.statSync(abs);
        if (st.isFile()) {
            pendingAdds.push(addFile(abs, item));
        } else if (st.isDirectory()) {
            walkAndAdd(abs, item);
        }
    }

    await Promise.all(pendingAdds);

    const blob = await writer.close();
    const arrayBuffer = await blob.arrayBuffer();
    fs.writeFileSync(zipPath, Buffer.from(arrayBuffer));
    console.log(`\nPackage created successfully: ${zipPath}`);
    return true;
}

(async () => {
    try {
        await createWithZipJS();
    } catch (error) {
        console.error('Error creating package:', error && error.message ? error.message : error);
        process.exit(1);
    }
})();
