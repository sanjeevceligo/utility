const { exec } = require('child_process');
const fs = require('fs');
const XLSX = require('xlsx');
const readline = require('readline');
const path = require('path');

const commands = [
    'docker ps -a', 
    'docker images',
    'kubectl get storageclass',
    'kubectl get pods',
    'docker compose  --env-file envs/local-env.env -f docker/kafka-configurable.yaml  -p localsetup-store stop',
    'docker compose  --env-file envs/local-env.env -f docker/kafka-configurable.yaml  -p localsetup-store  up -d'
];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const getTimestamp = () => {
    return new Date().toISOString().replace(/[:.]/g, '-');
};

const runCommand = (command, delay) => {
    return new Promise((resolve) => {
        exec(command, (error, stdout, stderr) => {
            let result = error ? stderr : stdout;
            let timestamp = getTimestamp();
            let filename = `output_${command.replace(/\s+/g, '_')}_${timestamp}.txt`;
            fs.writeFileSync(filename, result.trim());
            
            console.log(`Executed: ${command}, Output saved to: ${filename}`);
            setTimeout(() => resolve(result), delay);
        });
    });
};

const executeCommands = async (delay, repetitions) => {
    for (let i = 0; i < repetitions; i++) {
        console.log(`Iteration ${i + 1} of ${repetitions}`);
        for (let command of commands) {
            await runCommand(command, delay);
        }
    }

    console.log("Execution done");
    rl.close();
};

rl.question("Delay before running next command in seconds: ", (delayInput) => {
    const delay = parseInt(delayInput) * 1000;
    if (isNaN(delay) || delay < 0) {
        console.log("Invalid delay. Defaulting to 5 seconds.");
    }

    rl.question("Enter number of times to run set of commands: ", (repeatInput) => {
        const repetitions = parseInt(repeatInput);
        if (isNaN(repetitions) || repetitions <= 0) {
            console.log("Invalid repetition. Defaulting to 3 times.");
            executeCommands(delay || 5000, 3);
        } else {
            executeCommands(delay || 5000, repetitions);
        }
    });
});
