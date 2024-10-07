const fs = require('fs');
const path = require('path');
const https = require('https');
const marked = require('marked').marked;
const grayMatter = require('gray-matter');
const csvParser = require('csv-parser');

// defaults for json structure
const SPACE_ID_DEFAULT = 4112941493
const STATUS_DEFAULT = "current" // draft or current
const PARENT_ID_DEFAULT = "5573869571"
const ROOT_LEVEL = false

// Utility function to minify HTML by removing newlines and extra spaces
function minifyHtml(html) {
  return html.replace(/>\n</g, '><');
}

// Function to extract the first Markdown heading (#) as title
function extractTitleFromMarkdown(markdown) {
  const lines = markdown.split('\n');
  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('# ')) {
      return line.replace('# ', '').trim(); // Return the heading without the '#'
    }
  }
  return null; // Return null if no heading is found
}

// Function to convert markdown with frontmatter to JSON
function convertMarkdownToJson(markdown, filePath) {
  const parsed = grayMatter(markdown);
  let spaceId = parsed.data.spaceId || SPACE_ID_DEFAULT;
  let status = parsed.data.status || STATUS_DEFAULT;
  let title = parsed.data.title || extractTitleFromMarkdown(parsed.content);
  let parentId = parsed.data.parentId || PARENT_ID_DEFAULT;
  let htmlContent = marked(parsed.content);
  htmlContent = minifyHtml(htmlContent);

  return {
    filePath,
    spaceId,
    status,
    title,
    parentId,
    body: {
      value: htmlContent,
      representation: "storage"
    }
  };
}

// Step 1: Convert markdown files to JSON based on CSV file
function convertMarkdownToJsonFile(csvFilePath) {
  const inputFiles = []; 
  fs.createReadStream(csvFilePath)
    .pipe(csvParser())
    .on('data', (row) => {
      const fileName = row.filename;
      if (fileName.endsWith('.md')) {
        inputFiles.push(fileName);
      }   
    })  
    .on('end', () => {
      inputFiles.forEach((inputFile) => {
        try {
          // Read the markdown file synchronously
          const markdownData = fs.readFileSync(path.join(__dirname, inputFile), 'utf8');
          
          // Convert the markdown content to JSON
          const jsonData = convertMarkdownToJson(markdownData, inputFile);
          
          // Define the path for the corresponding JSON file
          const jsonFileName = inputFile.slice(0, -3) + '.json'; // Replace .md with .json
          const jsonPath = path.join(__dirname, jsonFileName);

          // Write the JSON data to the corresponding file
          fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
          console.log(`${jsonFileName} created successfully. ${jsonPath}`);
          sendApiRequest(jsonPath); // Proceed to the next step
        } catch (err) {
          console.error(`Error processing file ${inputFile}: ${err}`);
        }
      });
    })  
    .on('error', (err) => {
      console.error(`Error reading CSV file: ${err}`);
    });
}

function c1onvertMarkdownToJsonFile(csvFilePath) {
  const inputFiles = [];
  fs.createReadStream(csvFilePath)
    .pipe(csvParser())
    .on('data', (row) => {
      const fileName = row.filename;
      if (fileName.endsWith('.md')) {
        inputFiles.push(fileName);
      }
    })
    .on('end', () => {
      const jsonArray = [];
      inputFiles.forEach((inputFile) => {
        const markdownData = fs.readFileSync(path.join(__dirname, inputFile), 'utf8');
        const jsonData = convertMarkdownToJson(markdownData, inputFile);
        jsonArray.push(jsonData);
      });

      const jsonPath = path.join(__dirname, 'data.json');
      fs.writeFileSync(jsonPath, JSON.stringify(jsonArray, null, 2));
      console.log(`data.json created successfully.`);
      //sendApiRequest(jsonPath); // Proceed to the next step
    })
    .on('error', (err) => {
      console.error(`Error reading CSV file: ${err}`);
    });
}

// Step 2: Send API request to create pages
function sendApiRequest(jsonPath) {
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const token = process.env.JIRA_API_TOKEN;

  const options = {
    hostname: 'mirantis.jira.com',
    path: ROOT_LEVEL ? 'wiki/api/v2/pages?root-level=true' : '/wiki/api/v2/pages',
    method: 'POST',
    headers: {
      'Authorization': `Basic ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(jsonData))
    }
  };

  const req = https.request(options, (res) => {
    let responseBody = '';
    res.on('data', (chunk) => {
      responseBody += chunk;
    });
    res.on('end', () => {
      console.log('API Response:', responseBody);
      const apiResponse = JSON.parse(responseBody);
      const pageIds = apiResponse.pageIds; // Assuming the response contains page IDs
      updateMarkdownFilesWithIds(jsonPath, pageIds); // Proceed to update markdown files
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.write(JSON.stringify(jsonData));
  req.end();
}

// Step 3: Get page IDs by title and update markdown files
function getPageIdByTitle(title, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'mirantis.jira.com',
      path: `/wiki/rest/api/content/search?cql=title~"${encodeURIComponent(title)}"`,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonResponse = JSON.parse(data);
          if (jsonResponse.results && jsonResponse.results.length > 0) {
            const pageId = jsonResponse.results[0].id;
            resolve(pageId);
          } else {
            reject(`No page found with title: ${title}`);
          }
        } catch (error) {
          reject(`Error parsing response: ${error}`);
        }
      });
    });

    req.on('error', (e) => {
      reject(`Request error: ${e.message}`);
    });

    req.end();
  });
}

// Function to update markdown frontmatter with page ID
function updateMarkdownFrontmatterWithId(filePath, pageId) {
  let content = fs.readFileSync(filePath, 'utf8');
  const frontmatterEnd = content.indexOf('---', 3);

  const newFrontmatter = `id: ${pageId}\n`;
  content = content.slice(0, frontmatterEnd) + newFrontmatter + content.slice(frontmatterEnd);

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${filePath} with page ID: ${pageId}`);
}

// Step 4: Update markdown files with page IDs
async function updateMarkdownFilesWithIds(jsonPath, pageIds) {
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  for (const [index, page] of jsonData.entries()) {
    const title = page.title;
    const markdownFile = page.filePath;

    try {
      const pageId = await getPageIdByTitle(title, process.env.JIRA_API_TOKEN);
      updateMarkdownFrontmatterWithId(markdownFile, pageId);
    } catch (error) {
      console.error(`Error updating ${title}:`, error);
    }
  }
}

// Main execution
const csvFilePath = process.argv[2];

if (csvFilePath) {
  convertMarkdownToJsonFile(csvFilePath);
} else {
  console.error('Please provide the path to the markdown-files.csv');
}
