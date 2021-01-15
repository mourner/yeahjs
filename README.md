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
import {compile} from 'yeahjs';

const template = compile(ejs);
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
- File handling **not included** — provide it with `read` and `resolve` options (see [example](#file-handling)).

Otherwise `yeahjs` produces identical output to `ejs`.

### Strict mode only

The `with` keyword has a very significant impact on performance in JavaScript, in addition to introducing hard to debug issues. Limiting `yeahjs` to strict mode makes sure it's always as fast and predictable as possible.

### Static path includes

Static path includes make sure `yeahjs` can fully compile templates with includes at `compile` time, avoiding lazy compilation during template evaluation. This makes evaluation faster and more predictable.

### Custom file handling

Not including any file-system-specific code makes `yeahjs` environment-agnostic, having the same bundle for both Node and the browsers and giving full control over how includes get read and resolved.

## Usage

```js
import {compile} from 'yeahjs';

const template = compile(ejs, options);
````

Returns a function of the form `(data) => content`. Options:

- `localsName`: the namespace to use for accessing template data (`locals` by default for `<%= locals.foo %>`).
- `locals`: an array of variables to access directly (e.g. `['foo']` will allow `<%= foo %>` instead of `<%= locals.foo %>`).
- `context`: an object to use as `this` in templates (`null` by default).
- `escape`: a custom escaping function for values inside `<%= ... %>` (escapes XML by default).
- `async`: if `true`, generates an async function to make it possible to use `await` inside templates (`false` by default).
- `filename`: the file name of the template if present (used for resolving includes).
- `read`: a function of the form `(filename) => content` for reading includes (e.g. from file system in Node).
- `resolve`: a function of the form `(parentPath, includePath) => path` for resolving include paths.
- `cache`: an object to cache compiled includes in for faster compilation; reuse between `compile` runs for best performance (`{}` by default).

## EJS cheatsheet

- `<%= value %>`: output the value (escaped).
- `<%- value %>`: output the value (raw).
- `<% code %>`: use arbitrary JavaScript.
- `<%_ code %>`: use arbitrary JavaScript and strip whitespace on the same line before the tag.
- `... _%>`: strip whitespace and a single line break on the same line after the tag.
- `... -%>`: strip a single line break immediately after the tag.
- `<%%`, `%%>`: output literal `<%` or `%>`.
- `<%# comment %>`: comment (ignored).
- `<%- include('path/to/template.ejs', {foo: bar}) %>`: include another template, optionally passing data.

## File handling

An example of using `read`, `resolve` and `filename` options in Node.js to process includes:

```js
import {readFileSync} from 'fs';
import {join, dirname} from 'path';

const template = yeahjs.compile(`<%- include('../bar.html') %>`, {
    filename: 'foo/foo.html',
    resolve: (parent, filename) => join(dirname(parent), filename),
    read: filename => readFileSync(filename, 'utf8')
});
```
