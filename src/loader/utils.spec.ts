import { resolve } from 'path';
import { readFileSync } from 'fs';
import { parse } from '@babel/parser';
import { traverse } from '@babel/core';
import * as console from 'node:console';

import { findParentExpression } from './utils';

describe('find parent expression', () => {
  const content = readFileSync(resolve(__dirname, './__mock__/file-class.js'));
  const parsed = parse(content.toString(), { ranges: true, createParenthesizedExpressions: true });
  traverse(parsed, {
    enter: (node) => {
      console.log(findParentExpression(node));
    },
  });
});
