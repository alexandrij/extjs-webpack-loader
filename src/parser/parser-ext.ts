import fs from 'fs';

import { ParserDir } from './parser-dir';
import { ClassMap, File, FileMap, ParserOptions } from './types';

const cacheDir = './.cache';

export class ParserExt {
  private readonly options: ParserOptions;
  private classMap: ClassMap;
  private fileMap: FileMap;
  private classMapPromise: Promise<ClassMap>;

  constructor(options: ParserOptions) {
    this.options = options ;
    this.classMap = {};
    this.fileMap = {};
    this.checkDirectory(cacheDir);
    this.classMapPromise = this.getClassMap();
  }

  checkDirectory(directory: string) {
    try {
      fs.statSync(directory);
    } catch (e) {
      fs.mkdirSync(directory);
    }
  }

  getFileMap() {
    return this.fileMap;
  }

  getClassMap(): Promise<ClassMap> {
    const parseDir = new ParserDir(this.options);
    const version = parseDir.readVersion();
    const cacheFile = cacheDir + '/' + version;

    if (fs.existsSync(cacheFile)) {
      // TODO можно асинхронно
      const cachedResult = JSON.parse(fs.readFileSync(cacheFile, { encoding: 'utf-8' }));
      this.classMap = cachedResult.classMap;

      return cachedResult.classMap;
    } else {
      return parseDir.parse().then(() => {
        this.classMap = parseDir.classMap;
        this.fileMap = parseDir.fileMap;

        // TODO можно асинхронно
        fs.writeFileSync(cacheFile, JSON.stringify(parseDir));

        return parseDir.classMap;
      });
    }
  }

  async ready() {
    return this.classMapPromise;
  }

  async getClassMapCache() {
    return this.classMapPromise.then(() => {
      return this.classMap;
    });
  }

  async query(className: string): Promise<File[]> {
    const classMapCache = await this.getClassMapCache();

    const obj: ClassMap = className.split('.').reduce((obj, key) => {
      return typeof obj !== 'undefined' && key !== '*' ? obj[key] : obj;
    }, classMapCache);

    const res: File[] = [];

    if (typeof obj === 'undefined') {
      return res;
    }

    if (obj.classProp) {
      res.push(obj.classProp as File);
    }

    if (className.indexOf('*') > -1) {
      const filess = await Promise.all(
        Object.keys(obj).map((key) => {
          return this.query(className.replace('*', '') + key);
        }),
      );

      filess.forEach((files) => {
        res.push(...files);
      });
    }

    return res;
  }
}
