const axios = require("axios");
const yaml = require("yaml");
const ExcelJS = require("exceljs");
const chalk = require("chalk");
const prompt = require("prompt-sync")(); 

const GITHUB_TOKEN = "test";
const REPO_OWNER = "test";
const FOLDERS = ["io", "core"];
const headers = {
  Authorization: `token ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github.v3+json",
};

// ===== Config =====
const ENVIRONMENTS = {
  "QA": { env: "QA", repo: "cd", branch: "qa1" },
  "IA-QA": { env: "IA-QA", repo: "cd", branch: "ia-qa" },
  "STAGING": { env: "STAGING", repo: "cd-staging", branch: "staging" },
};

// ===== Helper to fetch microservice folders =====
async function fetchMicroserviceFolders(repo, branch, baseFolder) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${repo}/contents/${baseFolder}?ref=${branch}`;
  try {
    const res = await axios.get(url, { headers });
    return res.data
      .filter(item => item.type === "dir")
      .map(item => ({ name: item.name, baseFolder }));
  } catch (err) {
    console.error(`Failed to fetch folders for ${repo}/${branch}/${baseFolder}:`, err.message);
    return [];
  }
}

async function fetchMicroserviceYaml(repo, branch, baseFolder, folderName) {
  const fileUrl = `https://api.github.com/repos/${REPO_OWNER}/${repo}/contents/${baseFolder}/${folderName}/microservice.yaml?ref=${branch}`;
  try {
    const res = await axios.get(fileUrl, { headers });
    const content = Buffer.from(res.data.content, 'base64').toString('utf-8');
    return yaml.parse(content);
  } catch (error) {
    console.warn(`⚠️ microservice.yaml missing in ${baseFolder}/${folderName} [${repo}/${branch}]`);
    return null;
  }
}

function extractTagFromYaml(doc) {
  const search = (obj) => {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const result = search(item);
        if (result) return result;
      }
    } else if (typeof obj === 'object' && obj !== null) {
      if (obj.name === 'app' && obj.deployment?.image?.tag) {
        return obj.deployment.image.tag;
      }
      for (const key of Object.keys(obj)) {
        const result = search(obj[key]);
        if (result) return result;
      }
    }
    return null;
  };
  return search(doc);
}

async function collectDataForEnvironment(envConfig) {
  const { repo, branch, env } = envConfig;
  const data = {};

  for (const folder of FOLDERS) {
    const services = await fetchMicroserviceFolders(repo, branch, folder);
    for (const { name: service } of services) {
      const yamlDoc = await fetchMicroserviceYaml(repo, branch, folder, service);
      if (!yamlDoc) continue;
      const tag = extractTagFromYaml(yamlDoc);
      if (tag) {
        const fullServiceName = `${folder}/${service}`;
        data[fullServiceName] = tag;
      }
    }
  }

  return { env, data };
}

function getAllServiceNames(envData) {
  const allServices = new Set();
  envData.forEach(({ data }) => {
    Object.keys(data).forEach(service => allServices.add(service));
  });
  return Array.from(allServices).sort();
}

function printMismatchesToConsole(envA, envB, dataA, dataB) {
  const services = new Set([...Object.keys(dataA), ...Object.keys(dataB)]);
  console.log(`\n🔍 Comparing ${envA} with ${envB}:\n`);
  console.log(chalk.bold("Microservice".padEnd(35)), chalk.bold(envA.padEnd(20)), chalk.bold(envB.padEnd(20)), chalk.bold("Mismatch?"));
  console.log("-".repeat(85));

  let mismatchCount = 0;

  for (const service of services) {
    const tagA = dataA[service] || "-";
    const tagB = dataB[service] || "-";
    const mismatch = tagA !== tagB;
    const status = mismatch ? chalk.red("❌") : chalk.green("✔");

    if (mismatch) mismatchCount++;

    console.log(
      service.padEnd(35),
      tagA.padEnd(20),
      tagB.padEnd(20),
      status
    );
  }

  console.log(`\nTotal mismatches: ${chalk.yellow(mismatchCount)}\n`);
}

async function generateMismatchExcel(envA, envB, dataA, dataB) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Tag Mismatches");

  const headerRow = ["Microservice", envA, envB, "Mismatch?"];
  const header = sheet.addRow(headerRow);

  header.eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFCCE5FF" }, 
    };
  });

  const allServices = new Set([...Object.keys(dataA), ...Object.keys(dataB)]);

  for (const service of allServices) {
    const tagA = dataA[service] || "-";
    const tagB = dataB[service] || "-";
    const mismatch = tagA !== tagB;

    const row = sheet.addRow([
      service,
      tagA,
      tagB,
      mismatch ? "Yes" : "No",
    ]);

    row.eachCell((cell, colNumber) => {
      if (colNumber > 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: mismatch ? "FFFFC7CE" : "FFC6EFCE" }, 
        };
      }
    });
  }

  // Auto fit columns
  sheet.columns.forEach(column => {
    let maxLength = 12;
    column.eachCell({ includeEmpty: true }, cell => {
      const len = cell.value?.toString().length || 0;
      maxLength = Math.max(maxLength, len);
    });
    column.width = maxLength + 2;
  });

  const filename = `microservice_mismatch_${envA}_vs_${envB}.xlsx`;
  await workbook.xlsx.writeFile(filename);
  console.log(`📄 Excel file created: ${filename}`);
}

async function main() {
  const availableEnvs = Object.keys(ENVIRONMENTS);

  console.log(chalk.cyan("Available environments: "), availableEnvs.join(", "));
  const currentEnvInput = prompt("Enter current environment: ").toUpperCase();
  const compareEnvInput = prompt("Enter environment to compare with: ").toUpperCase();

  if (!availableEnvs.includes(currentEnvInput) || !availableEnvs.includes(compareEnvInput)) {
    console.error(chalk.red("Invalid environment(s). Please choose from: " + availableEnvs.join(", ")));
    return;
  }

  const envAConfig = ENVIRONMENTS[currentEnvInput];
  const envBConfig = ENVIRONMENTS[compareEnvInput];

  console.log(`\n Fetching data for ${currentEnvInput} and ${compareEnvInput}...\n`);

  const resultA = await collectDataForEnvironment(envAConfig);
  const resultB = await collectDataForEnvironment(envBConfig);

  printMismatchesToConsole(currentEnvInput, compareEnvInput, resultA.data, resultB.data);
  await generateMismatchExcel(currentEnvInput, compareEnvInput, resultA.data, resultB.data);
}

main().catch(err => console.error("Error:", err.message));
