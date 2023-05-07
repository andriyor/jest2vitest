import { Project, SourceFile, Node, ImportDeclaration } from "ts-morph";
import { intersect } from "set-fns";

const argv = require("yargs-parser")(process.argv.slice(2));

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const jestGlobalApis = ["afterAll", "afterEach", "beforeAll", "beforeEach", "describe", "test", "it", "expect"];

const testApiProps = ["concurrent", "each", "only", "skip", "todo", "failing"];
const jestGlobalApiProps: Record<string, string[]> = {
  describe: ["each", "only", "skip"],
  it: testApiProps,
  test: testApiProps,
};

const jestGlobalApiPropsKeys = Object.keys(jestGlobalApiProps);

const apiNamesRecord: Record<string, string> = {
  createMockFromModule: "importMock",
  deepUnmock: "unmock",
  genMockFromModule: "importMock",
  requireActual: "importActual",
  requireMock: "importMock",
  setMock: "mock",
};

const apiNamesToMakeAsync = ["genMockFromModule", "createMockFromModule", "requireActual", "requireMock"];

const insertViteImport = (sourceFile: SourceFile) => {
  const namedImport: string[] = [];
  const api: string[] = [];
  const toRemove: ImportDeclaration[] = [];
  let firstImportNode = 0;

  sourceFile.forEachDescendant((node) => {
    if (Node.isImportDeclaration(node)) {
      if (!firstImportNode) {
        firstImportNode = node.getChildIndex();
      }
      const moduleSpecifierText = node.getModuleSpecifier().getText();
      if (moduleSpecifierText == '"@jest/globals"') {
        toRemove.push(node);
      }
    }

    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();
      if (Node.isIdentifier(expression)) {
        const expressionText = expression.getText();
        namedImport.push(expressionText);
      }

      if (Node.isPropertyAccessExpression(expression)) {
        const propExpression = expression.getExpression();

        // TODO: create functions
        if (Node.isPropertyAccessExpression(propExpression)) {
          const propExpressionNested = propExpression.getExpression();
          if (Node.isIdentifier(propExpressionNested)) {
            const propExpressionText = propExpressionNested.getText();
            const propExpressionName = expression.getName();

            if (
              jestGlobalApiPropsKeys.includes(propExpressionText) &&
              jestGlobalApiProps[propExpressionText].includes(propExpressionName)
            ) {
              api.push(propExpressionText);
            }

            if (propExpressionText === "jest") {
              propExpressionNested.replaceWithText("vi");
              api.push("vi");
            }
          }
        }

        if (Node.isIdentifier(propExpression)) {
          const propExpressionText = propExpression.getText();
          const propExpressionName = expression.getName();

          if (
            jestGlobalApiPropsKeys.includes(propExpressionText) &&
            jestGlobalApiProps[propExpressionText].includes(propExpressionName)
          ) {
            api.push(propExpressionText);
          }

          if (propExpressionText === "fit") {
            api.push("it");
            if (propExpressionName === "failing") {
              expression.replaceWithText("it.only.fails");
            }
            if (propExpressionName === "each") {
              expression.replaceWithText("it.only.each");
            }
          }

          if (propExpressionText === "jest") {
            if (propExpressionName === "disableAutomock") {
              const parent = node.getParent();
              if (Node.isExpressionStatement(parent)) {
                parent.remove();
                return;
              }
            }

            propExpression.replaceWithText("vi");
            api.push("vi");

            if (apiNamesRecord[propExpressionName]) {
              expression.getNameNode().replaceWithText(apiNamesRecord[propExpressionName]);

              if (apiNamesToMakeAsync.includes(propExpressionName)) {
                let parent = node.getParent();
                while (!Node.isArrowFunction(parent)) {
                  parent = parent?.getParent();
                }
                if (Node.isArrowFunction(parent)) {
                  parent.setIsAsync(true);
                }

                const nodeParent = node.getParent();
                if (Node.isVariableDeclaration(nodeParent)) {
                  nodeParent.setInitializer(`await ${node.getText()}`);
                }
              }
            }
          }
        }
        return;
      }

      if (Node.isIdentifier(expression)) {
        const expressionText = expression.getText();
        if (expressionText === "fit") {
          api.push("it");
          expression.replaceWithText("it.only");
        }
      }
    }
  });

  toRemove.forEach((node) => node.remove());

  const intersection = intersect(namedImport, jestGlobalApis);
  const importDeclarationString = `import { ${[...new Set([...intersection, ...api])]
    .sort()
    .join(", ")} } from "vitest";`;

  // just for compatability of tests
  if (firstImportNode) {
    sourceFile.insertStatements(firstImportNode, `${importDeclarationString}\n`);
  } else if (toRemove.length) {
    sourceFile.insertStatements(firstImportNode, `${importDeclarationString}\n\n`);
  } else {
    sourceFile.insertStatements(firstImportNode, importDeclarationString);
  }
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
