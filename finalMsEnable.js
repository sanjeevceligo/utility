const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');
const { Parser } = require('json2csv');

// Load environment variables from dev.env
dotenv.config({ path: path.join(process.env.PWD, 'env/dev.env') });

const platformFilePath = path.join(__dirname, 'src/helper/platform.ts');
let subSubFolderCount = 0;
let suiteResults = []; // Array to store suite results

// Function to read the platform.ts file and extract AUTH_TOKEN for a given suite name
async function readPlatformFile(suiteName) {
  try {
    // Read the platform.ts file
    const data = await fs.readFile(platformFilePath, 'utf-8');

    // Initialize variables to store AUTH_TOKEN
    let AUTH_TOKEN = '';

    // Split the file content by lines
    const lines = data.split('\n');

    // Flag to track if we are inside the current suite's case
    let inSuiteCase = false;

    // Iterate through each line of the file
    for (let line of lines) {
      // Remove leading/trailing whitespace
      line = line.trim();

      // Check if we are inside the current suite's case
      if (line.startsWith(`case "${suiteName.toUpperCase()}"`)) {
        inSuiteCase = true;
      } else if (inSuiteCase && line.includes('AUTH_TOKEN')) {
        // Extract AUTH_TOKEN value
        AUTH_TOKEN = line.split('=')[1].trim().replace(/;/g, '').replace(/"/g, '').trim();
        break;
      } else if (inSuiteCase && line.startsWith('}')) {
        // Stop reading once we reach the end of the current suite's case
        break;
      }
    }

    let x = AUTH_TOKEN;
    // Get the AUTH_TOKEN value from environment variables
    const withoutEnv = x.replace(/process\.env\[|\]/g, '');
    console.log("env tokens are", withoutEnv);
    let value = process.env[withoutEnv];
    console.log("env values are", value);
    console.log(`AUTH_TOKEN for ${suiteName}: ${AUTH_TOKEN}: ${value}`);

    // Return suite name and AUTH_TOKEN
    return { suiteName, value };
  } catch (err) {
    console.error(`Error reading platform.ts file for suite ${suiteName}:`, err);
    return { suiteName, AUTH_TOKEN: 'Error' }; // Return error state
  }
}

// Function to make Create integration to API with Bearer token
async function fetchDataWithToken(token) {
  try {
    // Example POST request to v1/integrations
    const postData = {
      name: 'testIntegrationDelete' // Replace with your actual POST data
    };

    const response = await axios.post('https://api.staging.integrator.io/v1/integrations', postData, {
      headers: {
        'Authorization': `${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('POST Response:', response.data);

    // Example GET request to v1/audit/signedURL
    const signedUrlResponse = await axios.get('https://api.staging.integrator.io/v1/audit/signedURL', {
      headers: {
        'Authorization': `${token}`,
        'Content-Type': 'application/json'
      }
    });

    const signedURL = signedUrlResponse.data.signedURL;
    const parts = signedURL.split('/');

    // Find the segment that contains the desired value
    const userId = parts[parts.indexOf('audit') + 1];

    console.log("User ID:", userId);
    if (userId) return userId;
    return "undefined";
  } catch (error) {
    console.error(error);
    return "undefined";
  }
}

// Function to enable microservices for a given userId
async function enableMicroservices(token, userId) {
  try {
    const payload = {
      _ids: [userId],
      "keysToUpdate": {
        "microServices.enableWorkerService": true,
        "microServices.useNode18JSRT": true,
        "microServices.enableProxyMigration": true,
        "microServices.enableAS2Service": true,
        "microServices.enableRMService": true,
        "microServices.enableFMService": true,
        "microServices.enableEPService": true,
        "microServices.enableFtpJschUpgrade": true,
        "microServices.enableNetSuiteProxy": true,
        "microServices.enableAs2": true,
        "microServices.enableFile": true,
        "microServices.enableFtp": true,
        "microServices.enableHttp": true,
        "microServices.enableNetSuiteDistributed": true,
        "microServices.enableNetSuiteWebservices": true,
        "microServices.enableNsFile": true,
        "microServices.enableRdbms": true,
        "microServices.enableS3": true,
        "microServices.enableSalesforce": true,
        "microServices.enableEPServiceInternal": true,
        "microServices.enableFMServiceInternal": true,
        "microServices.enableFlowBranchingConversion": true,
        "microServices.enableRMServiceInternal": true,
        "microServices.disableMasterHttp": true,
        "microServices.disableMasterNetSuiteDistributed": true
      }
    };

    const response = await axios.patch('https://api.staging.integrator.io/v1/users', payload, {
      headers: {
        Authorization: `${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Microservices enabled for userId:', userId);
  } catch (error) {
    console.error('Error enabling microservices for userId:', userId, error);
    return "false";
  }
  return "true";
}

// Function to get sub-subfolder names and read platform.ts for each suite
async function getSubSubFolderNames(directory) {
  try {
    const files = await fs.readdir(directory, { withFileTypes: true });

    // Iterate through each file/directory
    for (const file of files) {
      if (file.isDirectory()) {
        const subFolderPath = path.join(directory, file.name);
        const subFiles = await fs.readdir(subFolderPath, { withFileTypes: true });

        for (const subFile of subFiles) {
          if (subFile.isDirectory()) {
            const suiteName = subFile.name.toUpperCase(); // Get subfolder name as suite name
            console.log(suiteName); // Print only the folder name
            const result = await readPlatformFile(suiteName);
            const userId = await fetchDataWithToken(result.value);
            const msEnable = await enableMicroservices(result.value, userId);
            suiteResults.push({ suiteName, AUTH_TOKEN: result.value, userId, msEnable}); // Store the result
            subSubFolderCount++; // Increment the counter
          }
        }
      }
    }

    // Print the total number of sub-subfolders (suites)
    console.log("Total Suites are:", subSubFolderCount);

    // Print the results as a table
    console.table(suiteResults);

    // Write results to CSV file
    const csvParser = new Parser();
    const csvData = csvParser.parse(suiteResults);
    const csvFilePath = path.join(__dirname, 'suiteResults.csv');
    await fs.writeFile(csvFilePath, csvData, 'utf-8');
    console.log(`Results written to ${csvFilePath}`);
  } catch (err) {
    console.error('Unable to scan directory:', err);
  }
}

// Specify the directory containing subfolders
const directoryPath = path.join(__dirname, 'testcases');

// Call the function to get sub-subfolder names and read platform.ts for each suite
getSubSubFolderNames(directoryPath);
