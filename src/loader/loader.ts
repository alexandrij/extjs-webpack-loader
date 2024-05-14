import type * as webpack from 'webpack';
import { traverse } from '@babel/core';
import {
  isArrayExpression,
  isIdentifier,
  isObjectExpression,
  isObjectProperty,
  isProperty,
  isStringLiteral,
} from '@babel/types';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
import * as fs from 'fs';

import { ParserExt } from '../parser';
import { Config, ConfigOption, LoaderOptions, SourceMap, Updated } from './types';
import {
  addRequire,
  findParentExpression,
  isConfigMapOption,
  isParseExt, isPathOption,
  resolveClassFile,
  sha1,
} from './utils';

const cacheDir = './.cache';
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir);
}

export function loader(this: webpack.LoaderContext<LoaderOptions>, content: string, sourceMap: SourceMap) {
  this.cacheable && this.cacheable();

  const callback = this.async();

  const { paths, nameSpace, debug } = this.getOptions();
  const parsersMap: Record<string, ParserExt> = {};

  const configMap: Config = {
    requires: {
      remove: true,
    },
    mixins: {
      allowObject: true,
    },
    override: true,
    extend: true,
    uses: {
      end: true,
    },
    stores: {
      prefix: nameSpace + '.store.',
    },
    controllers: {
      prefix: nameSpace + '.controller.',
    },
    controller: true,
  };

  const updates: Updated[] = [];
  const properties = Object.keys(configMap);

  const contentDigest = sha1(content);
  const cacheFile = cacheDir + '/content_' + contentDigest;

  if (fs.existsSync(cacheFile)) {
    const cachedContent = fs.readFileSync(cacheFile, { encoding: 'utf-8' });
    callback(null, cachedContent, sourceMap);
    return;
  }

  Promise.all(Object.keys(paths).map((map) => {
    const pathOption = paths[map];

    if (!isPathOption(pathOption)) {
      return Promise.resolve();
    } else {
      if (pathOption.use === undefined) {
        return Promise.resolve();
      } else if (isParseExt(pathOption.use)) {
        return pathOption.use.ready();
      } else {
        const UseClass = require(pathOption.use);
        const ctor = new UseClass(pathOption.options);
        parsersMap[map] = ctor;

        return ctor.ready().then(() => {
          if (Array.isArray(pathOption.options?.aliasForNs)) {
            pathOption.options?.aliasForNs.forEach((ns) => {
              parsersMap[ns] = ctor;
            });
          }
        });
      }
    }


  })).then(() => {
    const ExtParser = parsersMap['Ext'];
    const promises: Promise<string[]>[] = [];

    if (ExtParser) {
      const fileProps = ExtParser.getFileMap()[this.resourcePath];

      if (fileProps && fileProps.requires && fileProps.requires.length > 0) {
        promises.push(...fileProps.requires.map((require) => {
          return ExtParser.query(require).then((result) => {
            return result.map((require) => `require('${require.src}');`);
          });
        }));
      }

      if (fileProps && fileProps.override) {
        promises.push(ExtParser.query(fileProps.override).then((result) => {
          return result.map((require) => `require('${require.src}');`);
        }));
      }
    }

    return Promise.all(promises).then((results) => {
      const requiresStr = results.flat(1).filter((str) => str.length > 0).join('\n');
      updates.push({ type: 'add', start: 0, end: 0, data: requiresStr });

      return updates;
    });
  }).then((updates) => {
    const parenthesizedTree = parse(content, { ranges: true, createParenthesizedExpressions: true });
    traverse(parenthesizedTree, {
      enter: (path) => {
        const node = path.node;
        let requireStr = '';

        if (isProperty(node) && isIdentifier(node.key) && properties.includes(node.key.name)) {
          const nodeName = node.key.name;
          const key = nodeName as keyof Config;
          const config = configMap[key];
          const prefix: string = isConfigMapOption(config) && config.prefix || '';

          if (isStringLiteral(node.value)) {
            requireStr += addRequire(node.value.value, prefix, paths, debug);
          } else if (isArrayExpression(node.value)) {
            node.value.elements.forEach((element) => {
              if (isStringLiteral(element)) {
                requireStr += addRequire(element.value, prefix, paths, debug);
              }
            });
          } else if (isObjectExpression(node.value) && isConfigMapOption(config) && config.allowObject) {
            node.value.properties.forEach((node) => {
              if (isObjectProperty(node) && isStringLiteral(node.value)) {
                requireStr += addRequire(node.value.value, prefix, paths, debug);
              }
            });
          }

          if (requireStr.length > 0) {
            const parent = findParentExpression(path);
            const configOption: ConfigOption = isConfigMapOption(config) ? config : {};

            if (configOption.remove && node.range) {
              updates.push({ type: 'remove', start: node.range[0], end: node.range[1] });
            }

            if (parent && parent.node && parent.node.range) {
              updates.push({
                type: 'add',
                start: parent.node.range[configOption?.end ? 1 : 0],
                end: parent.node.range[configOption.end ? 1 : 0],
                data: requireStr,
              });
            }
          }
        }
      },
    });
    return updates;
  }).then((updates) => {
    updates.sort((a, b) => {
      return b.end - a.end;
    }).forEach(updateItem => {
      if (updateItem.type === 'remove') {
        content = content.slice(0, updateItem.start) + content.slice(updateItem.end).replace(/^\s*,/im, '');
      } else if (updateItem.type === 'add') {
        content = [content.slice(0, updateItem.start), updateItem.data, content.slice(updateItem.start)].join('');
      }
    });

    try {
      content = content.replace(/Ext.safeCreate\(['"](.*)['"]/img, function(match, offset) {
        const resolvedClasses = resolveClassFile(offset, paths);
        let className;

        if (resolvedClasses.length === 0) {
          throw new Error(`Couldn't resolve class: ${offset}`);
        } else {
          className = resolvedClasses[0];
        }

        return 'require(' + generate({
          type: 'StringLiteral',
          value: className,
        }) + ');\r\n' + match;
      });

      fs.writeFileSync(cacheFile, content);
      callback(null, content, sourceMap);
    } catch (e) {
      console.error(`\x1b[31mError parsing ${this.resourcePath}`, e);
      // @ts-ignore
      callback(e);
    }
  });
};
