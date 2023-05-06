import { Project, SourceFile, SyntaxKind, printNode } from "ts-morph";
import { intersect } from "set-fns";

const argv = require("yargs-parser")(process.argv.slice(2));

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const jestGlobalApis = ["afterAll", "afterEach", "beforeAll", "beforeEach", "describe", "test", "it", "fit", "expect"];

const insertViteImport = (sourceFile: SourceFile) => {
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  const callExpressionsText = callExpressions.map((callExpression) => callExpression.getExpression().getText());
  const intersection = intersect(callExpressionsText, jestGlobalApis);
  const importDeclarationString = `import { ${[...intersection].join(", ")} } from 'vitest';`;

  sourceFile.insertStatements(0, importDeclarationString);
};


export const migrate = (path: string) => {
  const sourceFiles = project.getSourceFiles(path);

  console.log(sourceFiles.length)

  for (const sourceFile of sourceFiles) {
    console.log(sourceFile.getFilePath());
    insertViteImport(sourceFile);
  }

  project.save();
};

// migrate('test/__fixtures__/**/*.input.{tsx,ts,js}');
