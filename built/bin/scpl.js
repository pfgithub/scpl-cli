#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yargs = require("yargs");
const scpl_1 = require("scpl");
const fs = require("fs");
const path = require("path");
const chalk_1 = require("chalk");
const rp = require("request-promise");
//@ts-ignore
const qrcode = require("qrcode-terminal");
const argv = yargs
    .command("scpl [filename] [options]", "Compile ScPL file", yargs => yargs.positional("filename", {
    describe: "Input ScPL file name.",
    demand: "Input file is required"
}))
    .option("output", { alias: "o", describe: "Defaults to <input path>.scpl" })
    .option("qrcode", { alias: "q", type: "boolean" })
    .option("inverse", { alias: "c", type: "boolean" })
    .alias("h", "help").argv;
if (argv.h || argv.help) {
    console.log("Usage: scpl [inputfile] -o [outputfile]"); //eslint-disable-line no-console
    process.exit(1);
}
if (!argv._ || !argv._[0]) {
    console.log("Usage: scpl inputfile"); //eslint-disable-line no-console
    process.exit(1);
}
const inputPath = path.resolve(argv._[0]);
if (!argv.output) {
    const pos = inputPath.lastIndexOf(".");
    argv.output = `${inputPath.substr(0, pos < 0 ? inputPath.length : pos)}.shortcut`;
}
const outputPath = path.resolve((argv.o || argv.output));
if (argv.inverse) {
    console.log("Inverting");
    // read buffer
    const data = fs.readFileSync(inputPath);
    fs.writeFileSync(outputPath, scpl_1.inverse(data), "utf8");
    process.exit(0);
}
function throwError(filename, fileContent, error) {
    process.stdout.write("\n");
    filename = path.relative(process.cwd(), filename);
    if (error instanceof scpl_1.PositionedError) {
        console.log(`${chalk_1.default.blue(filename)}:${chalk_1.default.yellow(`${error.start[0]}`)}:${chalk_1.default.yellow(`${error.start[1]}`)} - ${error.message}`); //eslint-disable-line no-console
        console.log();
        const split = fileContent.split(`\n`);
        const startPos = [error.start[0] - 1, error.start[1] - 1];
        const endPos = [error.end[0] - 1, error.end[1] - 1];
        const num = `${chalk_1.default.inverse(`${error.start[0]}`)} `;
        const blankNum = `${chalk_1.default.inverse(`${" ".repeat(`${error.start[0]}`.length)}`)} `;
        if (startPos[0] === endPos[0]) {
            // line numbers are the same
            const line = split[startPos[0]];
            process.stdout.write(`${num}${line.substr(0, startPos[1])}${line.substr(startPos[1], endPos[1] - startPos[1])}${line.substr(endPos[1])}\n`);
            process.stdout.write(`${blankNum}${" ".repeat(startPos[1]) +
                chalk_1.default.red("~".repeat(endPos[1] - startPos[1]))}\n`);
        }
        else {
            const line = split[startPos[0]];
            process.stdout.write(`${num}${line}\n`);
            process.stdout.write(`${" ".repeat(startPos[1] + num.length)}^\n`);
        }
    }
    else {
        console.log(`${chalk_1.default.blue(filename)}:${chalk_1.default.yellow("???")}:${chalk_1.default.yellow("???")} - ${error.message}`); //eslint-disable-line no-console
    }
    process.exit(1);
    throw new Error("Process did not exit");
}
console.log(`Converting ${outputPath}`); //eslint-disable-line no-console
const started = new Date().getTime();
const extraParseActions = {
    "@import": (cc, filename) => {
        // extraParseActions is not yet supported
        if (!filename.canBeString(cc)) {
            throw filename.error(cc, "Filename must be a string");
        }
        const dir = path.dirname(inputPath);
        const importPath = path.join(dir, filename.asString(cc));
        console.log(`Importing \`${importPath}\`...`); //eslint-disable-line no-console
        if (!fs.existsSync(importPath)) {
            throw filename.error(cc, `File ${importPath} does not exist.`);
        }
        const fileCont = fs.readFileSync(importPath, "utf8");
        let actions;
        try {
            actions = scpl_1.parse(fileCont, { ccOverride: cc });
        }
        catch (e) {
            throwError(importPath, fileCont, e);
        }
        //actions.actions.forEach((action: any) => cc.add(action));
        console.log(`Done importing \`${importPath}\``); //eslint-disable-line no-console
    }
};
const fileCont = fs.readFileSync(inputPath, "utf8");
let plist;
try {
    plist = scpl_1.parse(fileCont, { makePlist: true, extraParseActions });
}
catch (e) {
    throwError(inputPath, fileCont, e);
}
if (argv.qrcode) {
    (async () => {
        console.log("Generating QR code");
        const response = await rp({
            method: "POST",
            uri: "https://file.io",
            formData: {
                file: {
                    value: plist,
                    options: {
                        filename: path.basename(outputPath),
                        contentType: "application/x-octet-stream"
                    }
                }
            }
        });
        const json = JSON.parse(response);
        const link = json.link;
        if (!link) {
            console.log("Error while uploading to generate qr code: ", response);
        }
        else {
            qrcode.generate(link);
        }
    })();
}
else {
    fs.writeFileSync(outputPath, plist);
}
console.log(`Done in ${new Date().getTime() - started}ms`); //eslint-disable-line no-console
