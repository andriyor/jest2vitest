import {
  ts,
  Project,
  SourceFile,
  Node,
  CallExpression,
  PropertyAccessExpression,
  LeftHandSideExpression,
} from "ts-morph";

import { replaceFalling } from "./replaceFalling";
import { replaceFit } from "./replaceFit";
import { addImports } from "./addImports";
import { replaceJestWithVi } from "./replaceJestWithVi";

const argv = require("yargs-parser")(process.argv.slice(2));

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});


const insertViteImport = (sourceFile: SourceFile) => {
  addImports(sourceFile);
  replaceFit(sourceFile);

  sourceFile.forEachDescendant((node) => {
    if (Node.isImportDeclaration(node)) {
      const moduleSpecifierText = node.getModuleSpecifier().getText();
      if (moduleSpecifierText == '"@jest/globals"') {
        node.remove();
        return;
      }
    }

    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();

      replaceFalling(node);

      if (Node.isPropertyAccessExpression(expression)) {
        replaceJestWithVi(node, expression);
      }
    }
  });
};

export const migrate = (path: string) => {
  const sourceFiles = project.getSourceFiles(path);

  console.log(sourceFiles.length);

  for (const sourceFile of sourceFiles) {
    console.log(sourceFile.getFilePath());
    insertViteImport(sourceFile);
  }

  return project.save();
};

// migrate("test/__fixtures__/**/*.input.{tsx,ts,js,mjs}");

// migrate("test/__fixtures__/misc/with-existing-imports.input.mjs");
