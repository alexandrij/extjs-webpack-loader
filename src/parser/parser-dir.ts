import { resolve, normalize } from 'path';
import { glob } from 'glob';

import pkg from '../../package.json';
import { ParserFile } from './parser-file';
import { ClassMap, File, FileMap, ParserOptions, SenchaPackage } from './types';

export class ParserDir {
  public fileMap: FileMap;
  public classMap: ClassMap;
  private path: string;
  private type: SenchaPackage['type'];
  private classPath: string | string[];
  private namespace: string;
  private packages: string[];
  private toolkit: string;

  constructor(options: ParserOptions) {
    this.fileMap = options.fileMap || {};
    this.classMap = options.classMap || {};
    this.path = options.path;

    const packageJson: SenchaPackage = ('sencha' in pkg ? pkg.sencha : pkg) as SenchaPackage;
    this.type = packageJson.type;

    if (packageJson.classpath && packageJson.type !== 'framework') {
      if (typeof packageJson.classpath === 'string') {
        this.classPath = normalize(packageJson.classpath.replace('${package.dir}', this.getPath()));
      } else {
        this.classPath = packageJson.classpath.map((path) => {
          return path.replace('${package.dir}', this.getPath()).replace('${toolkit.name}', options.toolkit);
        });
      }
    } else {
      this.classPath = normalize(this.getPath() + '');
    }

    this.namespace = options.namespace || packageJson.namespace || 'Ext';
    // this.namespace = this.namespace[0].toUpperCase() + this.namespace.slice(1, this.namespace.length);
    this.packages = options.packages ? options.packages : [];
    this.toolkit = options.toolkit;
  }

  readVersion(): string {
    return pkg.version;
  }

  getPath() {
    return resolve(normalize(this.path));
  }

  normalizeClass(file: string) {
    if (typeof this.classPath === 'string') {
      return this.namespace + file.replace(this.classPath, '').replace(/\//g, '.').replace('.js', '');
    } else {
      console.warn('expected this.classPath is string, but', this.classPath);
      return this.namespace + file.replace(this.classPath[0], '').replace(/\//g, '.').replace('.js', '');
    }
  }

  createNS(className: string): ClassMap {
    return className.split('.').reduce((obj, key) => {
      if (key !== '*') {
        obj = obj[key] = obj[key] || {};
      }
      return obj;
    }, this.classMap);
  }

  getNS(className: string): ClassMap {
    return className.split('.').reduce((val, key) => {
      return val ? val[key] : '';
    }, this.classMap);
  }

  saveClass(className: string, file: string) {
    const objValue = this.createNS(className);

    if (objValue) {
      const classProp: File = this.fileMap[file] || {};
      classProp.src = file;
      classProp.override = '';

      objValue.classProp = classProp;
    }
  }

  saveOverride(override: string, file: string) {
    if (override.length === 0) {
      return;
    }

    const obj = this.createNS(override);
    if (obj.classProp) {
      (obj.classProp as File).override = file;
    }
  }

  parse() {
    return this.processPackages(this.packages)
      .then(() => {
        return this.processToolkit(this.toolkit);
      })
      .then(this.processDir.bind(this));
  }

  processPackages(packages: string[]): Promise<void> {
    const path = this.classPath;

    return Promise.all(
      packages.map((req) => {
        const dirParser = new ParserDir({
          path: path + '/packages/' + req,
          toolkit: this.toolkit,
          classMap: this.classMap,
          fileMap: this.fileMap,
        });

        return dirParser.parse().then(() => {
          Object.assign(this.fileMap, dirParser.fileMap);
          return Object.assign(this.classMap, dirParser.classMap);
        });
      }),
    ).then((results) => {
      console.info('processPackages:', results);
    });
  }

  processToolkit(toolkit: string): Promise<ClassMap> {
    const path = this.classPath;

    if (this.type !== 'framework') {
      return Promise.resolve(this.classMap);
    }

    const dirParser = new ParserDir({
      path: path + '/' + toolkit + '/' + toolkit,
      toolkit: this.toolkit,
      fileMap: this.fileMap,
      classMap: this.classMap,
    });

    return dirParser.parse().then(() => {
      Object.assign(this.fileMap, dirParser.fileMap);
      return Object.assign(this.classMap, dirParser.classMap);
    });
  }

  processDir() {
    switch (this.type) {
      case 'toolkit': {
        return this.processPackage();
      }
      case 'code': {
        return this.processPackage();
      }
      case 'framework': {
        /* let dirParser = new parseDir({
         path: `${this.getPath()}/${this.toolkit}/${this.toolkit}`,
         toolkit: this.toolkit
         });
         return dirParser.parse().then(() => {
         Object.assign(this.fileMap, dirParser.fileMap);
         return Object.assign(this.classMap, dirParser.classMap);
         });
         break;*/
      }
      default: {
        throw new Error(`processDir: this.type is ${this.type}`);
      }
    }
  }

  processPackage(): Promise<void> {
    return new Promise((resolve) => {
      return this.processSrc()
        .then(this.processOverride.bind(this))
        .then(() => {
          resolve();
        });
    });
  }

  async processSrc() {
    const pathsToProcess = Array.isArray(this.classPath) ? this.classPath : [this.classPath];

    await Promise.all(
      pathsToProcess.map((path) => {
        return this.processPath(path + '/**/*.js');
      }),
    );
  }

  processPath(path: string): Promise<void> {
    return glob(path, {})
      .then((files) => {
        return Promise.all(
          files.map((file) => {
            return this.processFile(file);
          }),
        );
      })
      .then(() => {});
  }

  processOverride() {
    return this.processPath(this.classPath + '/../overrides/**/*js');
  }

  processFile(file: string) {
    const parser = new ParserFile({
      ignoreOverrides: this.namespace.toLowerCase() === 'deft',
    });

    return parser.parse(file).then(() => {
      this.fileMap[file] = {
        src: file,
        names: parser.names,
        requires: parser.requires,
        override: parser.override,
      };
      parser.names.forEach((className) => {
        this.saveClass(className, file);
      });
      this.saveClass(this.normalizeClass(file), file);
      this.saveOverride(parser.override, file);
    });
  }
}
