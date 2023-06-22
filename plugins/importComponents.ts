import { PluginOption } from "vite";

import * as path from "path";
import * as fs from "fs";

export function importComponents(): PluginOption {
    const fileRegex = /\?array(!.*)$/;

    return {
        name: "import-components",

        async resolveId(source, importer, options) {
            if (!fileRegex.test(source)) return;

            const dir = path.dirname(importer ?? "");

            return path.join(dir, source);
        },
        load(id) {
            if (!fileRegex.test(id)) return;

            const parts = id.split("?");
            const args = parts[1].split("!").splice(1);

            const dir = parts[0];

            let filesInDirectory = fs.readdirSync(dir);

            if (args.length > 0) {
                filesInDirectory = filesInDirectory.filter((f) =>
                    args.map((a) => "." + a).includes(path.extname(f))
                );
            }

            const normalize = (f) => "f" + f.replace(/-/g, "_");
            const strip = (f) => path.basename(f, path.extname(f));
            const transform = (f) => normalize(strip(f));

            const imports = filesInDirectory
                .map((f) => `import ${transform(f)} from "./${path.basename(dir)}/${f}";`)
                .join("\n");

            const ex = `export default [${filesInDirectory.map(transform).join(", ")}]`;

            return `${imports}\n${ex}`;
        },
    };
}
