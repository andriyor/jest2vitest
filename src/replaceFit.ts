import { Node, SourceFile } from "ts-morph";

export const replaceFit = (sourceFile: SourceFile) => {
  sourceFile.forEachDescendant((node) => {
    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();

      if (Node.isPropertyAccessExpression(expression)) {
        const propExpression = expression.getExpression();

        if (Node.isIdentifier(propExpression)) {
          const propExpressionText = propExpression.getText();

          if (propExpressionText === "fit") {
            propExpression.replaceWithText("it.only");
          }
        }
        return;
      }

      if (Node.isIdentifier(expression)) {
        const expressionText = expression.getText();
        if (expressionText === "fit") {
          expression.replaceWithText("it.only");
        }
      }
    }
  });
};
