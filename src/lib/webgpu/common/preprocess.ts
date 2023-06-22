import { lineRelationEnums } from "$components/WebGPUHistoPyramid/lineRelations";
import { TOLERANCE, ULP } from "./constants";

type Constants = Record<string, number>;

const commonConstants = {
    TOLERANCE,
    ULP,
    ...lineRelationEnums,
};

export async function preprocessWGSL(
    file: string,
    includedFiles = new Set<string>(),
    constants: Constants = {}
) {
    constants = { ...commonConstants, ...constants };
    const includeRegex = /#include "(.*)"/;
    const includeRegexG = /#include "(.*)"/g;

    const responses: Record<string, Promise<Response>> = {};

    file.match(includeRegexG)?.forEach((match) => {
        const include = match.match(includeRegex)![1];
        // console.log(include);

        if (includedFiles.has(include)) {
            return;
        }
        includedFiles.add(include);

        responses[include] = fetch("./shader/" + include);
    });

    await Promise.all(Object.values(responses));

    const loadedFiles: Record<string, string> = {};
    for (const path in responses) {
        const response = await responses[path];
        loadedFiles[path] = await (await response.blob()).text();
        loadedFiles[path] = await preprocessWGSL(loadedFiles[path], includedFiles);
    }

    // replace #include "path" with the contents of the file at path
    const content = file.replace(includeRegexG, (match, path) => {
        let content = loadedFiles[path] as string | undefined;
        if (!content) return "";
        content = replaceConstants(content, constants);

        return `/// FILE: ${path}\n` + content + `\n/// END FILE: ${path}\n`;
    });

    return content;
}

function replaceConstants(content: string, constants: Constants) {
    Object.entries(constants).forEach(([name, value]) => {
        const find = new RegExp(`constant\\s*${name}\\s*:\\s*([^\\s;]+)`, "g");
        const replace = `const ${name}: $1 = ${value}`;
        content = content.replaceAll(find, replace);
    });

    // console.log(content);
    return content;
}
