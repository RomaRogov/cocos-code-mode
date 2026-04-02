const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

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

function createPackage(root, zipName, items) {
  const outputPath = path.join(root, zipName);

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip');

    output.on('close', () => resolve(outputPath));
    output.on('error', (error) => reject(error));
    archive.on('error', (error) => reject(error));
    archive.pipe(output);

    for (const item of items) {
      const fullPath = path.join(root, item);
      fs.statSync(fullPath).isDirectory()
        ? archive.directory(fullPath, item)
        : archive.file(fullPath, { name: item });
    }

    archive.finalize();
  });
}

createPackage(projectRoot, zipFileName, filesToInclude)
  .then((outputPath) =>
    console.log(`\nPackage created successfully: ${outputPath}`),
  )
  .catch((error) => {
    console.error('Error creating package:', error.message);
    process.exit(1);
  });
