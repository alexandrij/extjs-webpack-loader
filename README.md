# Загрузчик Webpack для ExtJS - фреймворка


## Установка

```bash
npm install --save-dev extjs-webpack-loader
```

[//]: # (## Пример использовавания)

## Настройка

**webpack.config.js**
```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.js/,
        use: [
            {
                loader: 'extjs-loader',
                nameSpace: 'App',
                paths: {
                    'Ext': false,
                    'Ext.ux': false,
                    'Ext.pivot': 'packages/pivot',
                    'Override': 'src/overrides',
                    'App': 'src'
                }
            } ]
      }
    ]
  }
}
```
