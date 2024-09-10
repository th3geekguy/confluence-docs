const fs = require('fs');
const path = require('path');
const marked = require('marked').marked;  // Markdown parser

const convertMarkdownToHtml = (inputPath, outputPath) => {
  const markdown = fs.readFileSync(inputPath, 'utf-8');
  const html = marked(markdown);
  fs.writeFileSync(outputPath, html);
};

// Recursively read all markdown files and convert them
const convertAllMarkdownFiles = (dir) => {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      convertAllMarkdownFiles(filePath);
    } else if (path.extname(file) === '.md') {
      const outputFilePath = path.join('html', path.relative('.', filePath)).replace(/\.md$/, '.html');
      fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
      convertMarkdownToHtml(filePath, outputFilePath);
      console.log(`Converted ${filePath} to ${outputFilePath}`);
    }
  });
};

// Ensure the output directory exists
fs.mkdirSync('html', { recursive: true });

// Start conversion from the root directory
convertAllMarkdownFiles('.');
