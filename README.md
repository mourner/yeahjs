# yejs

A tiny, modern, fast implementation of EJS (Embedded JavaScript Templates).

```js
const template = yejs.compile(`<ul>
<% for (let word of locals.items) { -%>
  <li><%= word %></li>
<% } -%>
</ul>`);

const output = template({items: ['flour', 'water', 'salt', 'yeast']});
// <ul>
//   <li>flour</li>
//   <li>water</li>
//   <li>salt</li>
// </ul>
```

Designed to be a nearly drop-in replacement for [ejs](https://ejs.co/), with the following limitations:

- Strict mode only (no `with` keyword in compiled functions).
- Only static-resolution includes (`include('header.ejs')`, but not `include(dir + file)`).
- Caching and file reading not included — provide your own through the `include` option.
- No delimiter customization yet (can't think of use cases for this).
- No `async` templates yet.
