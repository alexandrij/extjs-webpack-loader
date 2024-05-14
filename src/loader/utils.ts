import * as crypto from 'crypto';
import { isExpressionStatement, isProgram } from '@babel/types';
import { NodePath } from '@babel/core';
import generate from '@babel/generator';
import * as console from 'node:console';

import { Config, ConfigOption, LoaderOptions, PathOption } from './types';
import { ParserExt } from '../parser';

export const sha1 = (data: string) => {
  return crypto.createHash('sha1').update(data, 'binary').digest('hex');
};

export const findParentExpression = (nodePath: NodePath): NodePath | null => {
  if (!nodePath) {
    return null;
  } else if (isExpressionStatement(nodePath.node) || isProgram(nodePath.node)) {
    return nodePath;
  }

  let parent: NodePath = nodePath;
  while (parent.parentPath) {
    parent = parent.parentPath;
  }

  return parent;
};

export const isParseExt = (option: unknown): option is ParserExt => {
  return typeof option === 'object' && option !== null && option instanceof ParserExt;
};

export const isPathOption = (option: unknown): option is PathOption => {
  return typeof option === 'object' && option !== null && ('use' in option || 'ready' in option || 'query' in option);
};

export const isConfigMap = (config: unknown): config is Config => {
  return typeof config === 'object' && config !== null;
};

export const isConfigMapOption = (option: any): option is ConfigOption => {
  return !option || typeof option === 'boolean' ? false : typeof option === 'object';
};

/**
 * Resolve the given className as a path using the options->paths mapping defined in the config
 *
 * @param className
 * @param pathMap
 * @param debug
 * @returns {*}
 */
export const resolveClassFile = (className: string, pathMap: LoaderOptions['paths'], debug?: boolean) => {
  let retVal: string[] = [];

  for (const prefix in pathMap) {
    const pathOption = pathMap[prefix];
    const re = new RegExp('^' + prefix);

    if (className.match(re)) {
      if (pathOption === false) {
        retVal = [];
      } else if (isPathOption(pathOption) && pathOption.query) {
        const classes = pathOption.query(className);
        retVal = classes.map((className) => {
          return className.src;
        });
      } else if (typeof pathOption === 'string') {
        retVal = [prefix.replace(prefix, pathOption) + className.replace(prefix, '').replace(/\./g, '/') + '.js'];
      } else {
        debug && console.log('%cno resolved class file:', 'color:yellow', `prefix: ${prefix}; className: ${className}`);
      }
      break;
    }
  }

  return retVal.filter(Boolean);
};


export function addRequire(className: string, prefix: string, pathMap: LoaderOptions['paths'], debug?: boolean) {
  if (className.indexOf('.') > 0 || prefix !== '' || className === 'Ext') {
    const fileToRequire = resolveClassFile(((className.indexOf('.') > 0) ? '' : prefix) + className, pathMap, debug);
    if (fileToRequire.length > 0) {
      let reqStr = '';
      fileToRequire.forEach((req) => {
        if (debug) {
          console.log('\x1b[32mConverting require:', `\x1b[0m${className} => ${req}`);
        }

        if (typeof req === 'undefined') {
          console.log('\x1b[31mConverting require:', `\x1b[0m${className} => ${req}`);
        }
        reqStr += `require(${generate({ type: 'StringLiteral', value: req }).code});\r\n`;
      });
      return reqStr;
    }
  }
  return '';
}
