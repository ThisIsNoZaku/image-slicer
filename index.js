import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import * as ajv from "ajv";
import { Image } from "image-js";

const validate = new ajv.default().compile({
    type: "object",
    properties: {
        cellSize: {
            type: "number"
        },
        slices: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    "name" : {
                        type: "string"
                    },
                    "width" : {
                        type: "number"
                    }
                }
            }
        }
    }
});

const previous = fs.existsSync("previous.json") ? JSON.parse(fs.readFileSync("previous.json", {
    encoding: 'UTF-8'
})) :  {

}

inquirer.prompt([
    {
        type: "input",
        message: "Enter path to image to process.",
        name: "selected-image",
        filter: function (input, answers) {
            if(input !== "") {
                var resolvedPath = path.resolve(input);
                previous['selected-image'] = resolvedPath;
                return resolvedPath;
            } else {
                return previous['selected-image'];
            }
        },
        validate(input, answers) {
            const finalPath = path.resolve(input);
            if(!fs.existsSync(finalPath)) {
                return `No file at ${finalPath} exists. Enter a valid path`;
            }
            return true;
        },
        transformer(input, answers, flags) {
            return !input && previous['selected-image'] ? previous['selected-image'] : input;
        },
    },
    {
        type: "input",
        message: "Enter path to slice definition file.",
        name: "selected-definition",
        validate(input, answers) {
            const finalPath = path.resolve(input);
            if(!fs.existsSync(finalPath)) {
                return `No file at ${finalPath} exists. Enter a valid path`;
            }
            const def = fs.readFileSync(finalPath);
            const validation = validate(def);
            if(!validation) {
                return false;
            }
            return true;
        },
        filter(input, answers) {
            if(input !== "") {
                var resolvedPath = path.resolve(input);
                previous['selected-definition'] = resolvedPath;
                return resolvedPath;
            } else {
                return previous['selected-definition'];
            }
        },
        transformer(input, answers, flags) {
            return !input && previous['selected-definition'] ? previous['selected-definition'] : input;
        },
    },
    {
        type: "input",
        name: 'output-directory',
        message: "Select output directory",
        validate(input, answers) {
            const finalPath = path.resolve(input);
            if(!fs.existsSync(finalPath)) {
                return `No directory at ${finalPath} exists. Enter a valid path`;
            }
            return true;
        },
        filter(input, answers) {
            if(input !== "") {
                var resolvedPath = path.resolve(input);
                previous['output-directory'] = resolvedPath;
                return resolvedPath;
            } else {
                return previous['output-directory'];
            }
        },
        transformer(input, answers, flags) {
            return !input && previous['output-directory'] ? previous['output-directory'] : input;
        },
    },
]).then(async (answers) => {
    const outputDirectory = answers['output-directory'];
    fs.writeFileSync("previous.json", JSON.stringify(answers));
    for(let file of fs.readdirSync(path.resolve(outputDirectory))) {
        fs.unlinkSync(path.resolve(outputDirectory, file));
    }
    const definition = JSON.parse(fs.readFileSync(answers['selected-definition']));
    const image = await Image.load(answers['selected-image']);
    const fileExt = path.extname(answers['selected-image']);
    let cellNum = 0;
    for(var slice = 0; slice < definition.slices.length; slice++) {
        const selectedSlice = definition.slices[slice];
        for(var i = 1; i <= selectedSlice.width; i++) {
            const widthStep = Math.floor(image.width / definition.cellSize);
            const x = (cellNum % widthStep) * definition.cellSize;
            const y = Math.floor(cellNum / widthStep) * definition.cellSize;
            const size = definition.cellSize;
            const fileName = `${selectedSlice.name}-${i}${fileExt}`

            console.log(`(cell ${cellNum}) x: ${x}, y: ${y}, size: ${size}x${size} => ${fileName}`);
            await image.clone().crop({
                x,
                y,
                width: size,
                height: size
            }).save(path.resolve(outputDirectory, fileName));
            cellNum++;
        }
    }
});