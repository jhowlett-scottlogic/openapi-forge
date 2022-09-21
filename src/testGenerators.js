//TODO: Once generators are published to npm use package instead of github repo. command 'npm install {packageName} -g --prefix {packageInstallLocation}' and then remember to uninstall at the end of testing generator.

const fs = require("fs");
const path = require("path");
const os = require("os");
const shell = require("shelljs");

const log = require("./log");
const testResultParser = require("./testResultParser");
const generatorResolver = require("./generatorResolver");

const typescriptData = {
    languageString: "TypeScript",
    languageLetter: "t",
    generatorURL: "https://github.com/jhowlett-scottLogic/openapi-forge-typescript.git"
}

const csharpData = {
    languageString: "CSharp",
    languageLetter: "c",
    generatorURL: "https://github.com/jhowlett-scottlogic/openapi-forge-csharp.git"
}

function setupAndStartTests(generatorPath, arg1, arg2) {
    shell.cd(generatorPath, log.shellOptions);

    log.standard("Starting tests");
    const test = shell.exec(`npm run test "${arg1}" "${arg2}"`, log.shellOptions);

    shell.cd(__dirname, log.shellOptions);
    return test.stdout.split("\n");
}

function getGenerator(languageData, generatorOption) {
    log.standard(`\n${log.bold}${log.underline}${languageData.languageString}${log.resetStyling}`);
    let generatorPath = path.resolve(path.join("../../../", generatorOption));

    log.standard(`Loading ${languageData.languageString} generator from '${generatorPath}'`);

    // Check for local generator.
    if (!fs.existsSync(generatorPath)) {
        log.verbose(`Cannot find ${languageData.languageString} generator`);

        if(process.argv.includes(`-${languageData.languageLetter}`) || process.argv.includes(`--${languageData.languageString.toLowerCase()}`)) {
            throw new Error(
                `No local ${languageData.languageString} generator found at ${generatorPath}.`
            );
        }

        // Local generator does not exist, clone from GitHub to temporary location
        generatorPath = generatorResolver.cloneGenerator(languageData.generatorURL, true);
    }
    return generatorPath;
}

async function testGenerators(options) {
    let resultArray = {};
    let exitCode = 0;

    log.setLogLevel(options.logLevel);

    const typescript = options.generators.includes(typescriptData.languageLetter);
    const csharp = options.generators.includes(csharpData.languageLetter);
    if(!typescript && !csharp) {
        throw new Error(
            `No language to test. Please provide a language that you would like to test.`
        );
    }

    shell.cd(__dirname, log.shellOptions);
    if(typescript) {
        // Test TypeScript generator
        try {
            const generatorPath = getGenerator(typescriptData, options.typescript);

            const featurePath = path.relative(generatorPath, path.join(__dirname, "../features/*.feature")).replaceAll("\\", "/");
            const basePath = path.relative(path.join(generatorPath, "features/support"), path.join(__dirname, "../src/generate")).replaceAll("\\", "/");

            const stdout = setupAndStartTests(generatorPath, featurePath, basePath);

            const result = testResultParser.parseTypeScript(stdout[stdout.length-2], stdout[stdout.length-4]);
            
            // check if failed/skipped/undefined steps in tests. If so OR them onto the exit code to stop overwriting previous errors
            exitCode = exitCode | testResultParser.checkTestResultForErrors(result);

            resultArray.TypeScript = result;

            log.standard(`${typescriptData.languageString} testing complete`);

        } catch(exception) {
            log.logFailedTesting(typescriptData.languageString, exception);
            exitCode = exitCode | 1;
        } finally {
    //        generatorResolver.cleanup();
        }
    }
    if(csharp) {
        // Test CSharp generator
        try {
            const generatorPath = getGenerator(csharpData, options.csharp);

            console.log("generatorPath:" + generatorPath);


            const featurePath = "/" + path.relative(path.join(generatorPath, "tests/FeaturesTests"), path.join(__dirname, "../features/*.feature")).replaceAll("\\", "/");

            console.log("__dirname:" + __dirname);
            
            console.log("featurePath:" + featurePath);

            const stdout = setupAndStartTests(generatorPath, featurePath.replaceAll("/", "\\"), "");

            const result = testResultParser.parseCSharp(stdout[stdout.length-2]);

            // check if failed/skipped/undefined steps in tests. If so OR them onto the exit code to stop overwriting previous errors
            exitCode = exitCode | testResultParser.checkTestResultForErrors(result);

            resultArray.CSharp = result;

            log.standard(`${csharpData.languageString} testing complete`);

        } catch(exception) {
            log.logFailedTesting(csharpData.languageString, exception);
            exitCode = exitCode | 1;
        } finally {
     //       generatorResolver.cleanup();
        }
    }
    //Present the results of the testing
    if(Object.keys(resultArray).length) {
        if(!log.isQuiet()) console.table(resultArray);
    }
    process.exit(exitCode);
}

module.exports = testGenerators;
