# yeahjs

A tiny, modern, fast implementation of EJS (Embedded JavaScript Templates). A nearly drop-in replacement for [`ejs`](https://ejs.co/) with a few [intentional limitations](#compared-to-ejs).

[![Build Status](https://github.com/mourner/yeahjs/workflows/Node/badge.svg?branch=master)](https://github.com/mourner/yeahjs/actions)
[![Install Size](https://packagephobia.now.sh/badge?p=yeahjs)](https://packagephobia.now.sh/result?p=yeahjs)
[![Min-zipped Size](https://badgen.net/bundlephobia/minzip/yeahjs)](https://bundlephobia.com/result?p=yeahjs)
[![Simply Awesome](https://img.shields.io/badge/simply-awesome-brightgreen.svg)](https://github.com/mourner/projects)

## Example

```ejs
<ul>
<% for (let word of locals.items) { -%>
  <li><%= word %></li>
<% } -%>
</ul>
```

```js
const template = yeahjs.compile(ejs);
const output = template({items: ['flour', 'water', 'salt']});
```

```html
<ul>
  <li>flour</li>
  <li>water</li>
  <li>salt</li>
</ul>
```

## Compared to `ejs`

There are a few key differences that allow `yeahjs` to be so small and fast:

- **Strict mode** only (no `with` keyword in compiled functions).
- Only **static path includes** (`include('header.ejs')`, but not `include(dir + file)`).
- Pluggable file handling — it's not included, but you can provide it with `read` and `resolve` options (see [example](#file-handling)).

Otherwise `yeahjs` identical output to `ejs`, passing all compilation and rendering tests.

## Options

```js
const template = yeahjs.compile(ejs, options);
````

- `localsName`: the namespace to use for accessing template data (`locals` by default).
- `locals`: an array of variables to make accessible directly (e.g. `['foo']` will allow `<%= foo %>` instead of `<%= locals.foo %>`).
- `context`: an object to use as `this` in templates (`null` by default).
- `escape`: a custom escaping function for values inside `<%= ... %>` (escapes XML by default).
- `async`: if `true`, generates an async function to make it possible to use `await` inside templates (`false` by default)
- `filename`: the file name of the template if present (used for resolving includes).
- `read`: a function of the form `(filename) => content` for reading includes (e.g. from file system in Node).
- `resolve`: a function of the form `(parentPath, includePath)` for resolving include paths (e.g. use `path.join(path.dirname(parent), filename)` in Node).
- `cache`: an object to cache compiled includes in for faster compilation; reuse between `compile` runs for best performance (`{}` by default).

## File handling

An example of using `read`, `resolve` and `filename` options in Node.js to process includes:

```js
const fs = require('fs');
const path = require('path');
const cache = {};

const template = ejs.compile(`<%- include('../bar.html') %>`, {
    filename: 'foo/foo.html',
    resolve: (parent, filename) => path.join(path.dirname(parent), filename),
    read: filename => fs.readFileSync(filename, 'utf8'),
    cache
});
```
