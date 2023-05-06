import { Project, SourceFile, SyntaxKind, printNode, Node } from "ts-morph";
import { intersect } from "set-fns";

const argv = require("yargs-parser")(process.argv.slice(2));

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const jestGlobalApis = ["afterAll", "afterEach", "beforeAll", "beforeEach", "describe", "test", "it", "fit", "expect"];

const insertViteImport = (sourceFile: SourceFile) => {
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  const namedImport = [];
  const api = [];

  for (const callExpression of callExpressions) {
    const expression = callExpression.getExpression();
    if (Node.isIdentifier(expression)) {
      const expressionText = expression.getText();
      namedImport.push(expressionText);
    }
    if (Node.isPropertyAccessExpression(expression)) {
      const propExpression = expression.getExpression();
      if (propExpression.getText() === "jest") {
        propExpression.replaceWithText("vi");
        api.push("vi");
      }
    }
  }

  const intersection = intersect(namedImport, jestGlobalApis);
  const importDeclarationString = `import { ${[...intersection, ...api].sort().join(", ")} } from "vitest";`;

  sourceFile.insertStatements(0, importDeclarationString);
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

// migrate('test/__fixtures__/**/*.input.{tsx,ts,js}');
