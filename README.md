# yeahjs

A tiny, modern, fast implementation of EJS (Embedded JavaScript Templates). A nearly drop-in replacement for [ejs](https://ejs.co/) with a few [opinionated limitations](#compared-to-ejs).

## Example

```ejs
<ul>
<% for (let word of locals.items) { -%>
  <li><%= word %></li>
<% } -%>
</ul>
```

```js
const template = yejs.compile(ejs);
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

- Strict mode only (no `with` keyword in compiled functions).
- Only static-resolution includes (`include('header.ejs')`, but not `include(dir + file)`).
- File handling not included, but you can provide it with `read` and `resolve` options (see example below).
- `cache` option accepts a simple object (`{}`).

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
