import { CallExpression, Node } from 'ts-morph';

export const replaceFalling = (node: CallExpression) => {
  const expression = node.getExpression();

  if (Node.isPropertyAccessExpression(expression)) {
    const propExpression = expression.getExpression();
    if (Node.isPropertyAccessExpression(propExpression)) {
      const propExpressionNested = propExpression.getExpression();
      if (Node.isIdentifier(propExpressionNested)) {
        const propExpressionText = propExpressionNested.getText();
        const expressionName = expression.getName();
        const propExpressionName = propExpression.getName();

        if (propExpressionText === 'it' || propExpressionText === 'test') {
          if (expressionName === 'failing') {
            expression.getNameNode().replaceWithText('fails');
          }
          if (propExpressionName === 'failing') {
            propExpression.getNameNode().replaceWithText('fails');
          }
        }
      }
    }

    if (Node.isIdentifier(propExpression)) {
      const propExpressionText = propExpression.getText();
      const propExpressionName = expression.getName();

      if (['fit', 'it', 'test'].includes(propExpressionText)) {
        if (propExpressionName === 'failing') {
          expression.getNameNode().replaceWithText('fails');
        }
      }
    }
  }
};
