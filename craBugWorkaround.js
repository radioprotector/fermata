#!/usr/bin/env node

// This is a workaround for the CRA bug https://github.com/facebook/create-react-app/issues/12503
const fs = require('fs');
const path = require('node:path');

const curDir = path.resolve('.');
const sourceFolderPath = path.join(curDir, 'build/static/js');
const destFolderPath = path.join(curDir, 'build/static/js/static/js');

// Ensure the source folder exists
fs.accessSync(sourceFolderPath, fs.constants.F_OK);

// Ensure the destination folder exists
try {
	fs.accessSync(destFolderPath, fs.constants.F_OK);
}
catch {
	fs.mkdirSync(destFolderPath, { recursive: true });
}

// Copy all chunk.js files
const jsFiles = fs.readdirSync(sourceFolderPath);

for(const jsFileName of jsFiles) {
	if (/\.chunk\.js$/.test(jsFileName)) {
		fs.copyFileSync(path.join(sourceFolderPath, jsFileName), path.join(destFolderPath, jsFileName));
	}
}
