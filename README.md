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
- Caching and file reading not included — provide your own through the `include` option.
- No delimiter customization yet (can't think of use cases for this).
- No `async` templates yet.
