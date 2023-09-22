import { Project, SourceFile, Node } from "ts-morph";

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
        if (expression.getName() === "mock") {
          const [moduleName, mock] = node.getArguments();
          if (Node.isArrowFunction(mock)) {
            const functionBody = mock.getBody();
            if (Node.isStringLiteral(functionBody)) {
              functionBody
                .replaceWithText(`({ default: ${functionBody.getText()} })`);
            }
          }
          if (Node.isFunctionExpression(mock)) {
            const functionBody = mock.getBody();
            if (Node.isBlock(functionBody)) {
              const functionStatements = functionBody.getStatements();
              const returnStatement =
                functionStatements[functionStatements.length - 1];
              if (Node.isReturnStatement(returnStatement)) {
                const returnExpression = returnStatement.getExpression();
                if (returnExpression) {
                  returnExpression.replaceWithText(
                    `{ default: ${returnExpression.getText()} }`
                  );
                }
              }
            }
          }
        }

        replaceJestWithVi(node, expression);
      }
    }
  });
};

export const migrate = (path: string) => {
  const sourceFiles = project.getSourceFiles(path);

  for (const sourceFile of sourceFiles) {
    insertViteImport(sourceFile);
  }

  return project.save();
};

// migrate("test/__fixtures__/**/*.input.{tsx,ts,js,mjs,mts}");

// migrate("test/__fixtures__/misc/with-existing-imports.input.mjs");

// migrate("test/__fixtures__/misc/with-top-line-comment.input.js");
