
const {test} = require('tape');
const {compile} = require('./index.js');

const users = [{name: 'Vlad'}, {name: 'Masha'}, {name: 'Dasha'}];

test('empty', (t) => {
    t.equal(compile('')(), '', 'empty');
    t.equal(compile('<p>')(), '<p>', 'no tags');
    t.end();
});

test('<%= %>', (t) => {
    t.equal(compile('<p><%= locals.foo %></p>')({foo: 'bar'}), '<p>bar</p>', 'locals');
    t.equal(compile('<%= locals.name %>')({name: '&nbsp;<script>\'s'}), '&amp;nbsp;&lt;script&gt;&apos;s', 'escape');
    t.equal(compile('<%= undefined %>')(), '', 'undefined');
    t.equal(compile('<%= null %>')(), '', 'null');
    t.equal(compile('<%= 0 %>')(), '0', '0');
    t.equal(compile('<%= // a comment\nlocals.name // another comment %>')({name: '&nbsp;<script>'}), '&amp;nbsp;&lt;script&gt;', 'comment');
    t.throws(() => compile('<h1>oops</h1><%= name ->'), /Could not find matching close tag for <%=/, 'close tag error');

    t.end();
});

test('<%- %>', (t) => {
    t.equal(compile('<%-\n// a comment\nlocals.name\n// another comment %>')({name: '&nbsp;<script>'}), '&nbsp;<script>', 'no escape');
    t.equal(compile('<%- undefined %>')(), '', 'undefined');
    t.equal(compile('<%- null %>')(), '', 'null');
    t.equal(compile('<%- 0 %>')(), '0', '0');
    t.throws(() => compile('<h1>oops</h1><%- name ->'), /Could not find matching close tag for <%-/, 'close tag error');

    const tpl = '<ul><% -%>\r\n<% locals.users.forEach(function(user){ -%>\r\n<li><%= user.name -%></li>\r\n<% }) -%>\r\n</ul><% -%>\r\n';
    t.equal(compile(tpl)({users}), '<ul><li>Vlad</li>\r\n<li>Masha</li>\r\n<li>Dasha</li>\r\n</ul>', 'windows line breaks');
    t.end();
});

test('%>, -%>', (t) => {
    t.equal(compile(`<ul>
  <% locals.users.forEach(function(user){ %>
    <li><%= user.name %></li>
  <% }) %>
</ul>`)({users}), `<ul>
${'  '}
    <li>Vlad</li>
${'  '}
    <li>Masha</li>
${'  '}
    <li>Dasha</li>
${'  '}
</ul>`, 'keep line endings');
    t.equal(compile('<% var a = \'foo\' %><% var b = \'bar\' %><%= a %>')(), 'foo', 'consecutive');
    t.equal(compile(`<ul>
  <% locals.users.forEach(function(user){ -%>
  <li><%= user.name %></li>
  <% }) -%>
</ul>`)({users}), `<ul>
    <li>Vlad</li>
    <li>Masha</li>
    <li>Dasha</li>
  </ul>`, 'strip line ending');
    t.end();
});

test('<%_, _%>', (t) => {
    const tpl = '<ul>\n\t<%_ locals.users.forEach(function(user){ _%>\t\n    <li><%= user.name %></li>\n\t<%_ }) _%> \t\n</ul>';
    t.equal(compile(tpl)({users}), `<ul>
    <li>Vlad</li>
    <li>Masha</li>
    <li>Dasha</li>
</ul>`, 'strip whitespace');
    t.end();
});

test('<%%, %%>', (t) => {
    t.equal(compile('<%%- "foo" %>')(), '<%- "foo" %>', 'left literal');
    t.equal(compile('<%%-')(), '<%-', 'left literal alone');
    t.equal(compile('%%>')(), '%>', 'right literal');
    t.end();
});

test('<% %>', (t) => {
    t.equal(compile(`<%
      var a = 'b'
      var b = 'c'
      var c
      c = b
    %><%= c %>`)(), 'c', 'no semicolons');
    t.throws(() => compile('<% function foo() return \'foo\'; %>'), 'syntax error');
    t.end();
});

test('characters', (t) => {
    t.equal(compile('<p><%= \'Vlad\' %>\'s guitar</p>')(), '<p>Vlad\'s guitar</p>', 'single quote');
    t.equal(compile('<p><%= "Vl" + \'ad\' %>\'s "guitar"</p>')(), '<p>Vlad\'s "guitar"</p>', 'double quote');
    t.equal(compile(String.raw`\foo`)(), String.raw`\foo`, 'backslash');
    t.equal(compile('<ul><%locals.users.forEach(function(user){%><li><%=user.name%></li><%})%></ul>')({users}),
        '<ul><li>Vlad</li><li>Masha</li><li>Dasha</li></ul>', 'no whitespace');
    t.equal(compile(String.raw`<%= "<p>foo</p>".match(/\<p>(.+)<\/p>/)[1] %>`)(), 'foo', 'regexps');
    t.end();
});

test('options', (t) => {
    t.equal(compile('<%= data.foo %>', {localsName: 'data'})({foo: 5}), '5', 'localsName');
    t.equal(compile('<%= foo %>', {locals: ['foo']})({foo: 5}), '5', 'locals');
    t.equal(compile('<%= this.foo %>', {context: {foo: 5}})(), '5', 'context');
    const escape = str => (!str ? '' : str.toUpperCase());
    t.equal(compile('<%= locals.name %>', {escape})({name: 'Vlad\'s'}), 'VLAD\'S', 'escape');
    t.end();
});

test('includes', (t) => {
    function include(filename, parent) {
        t.equal(parent, 'foo');
        return `<p><%= "HELLO ${filename}" %></p>`;
    }
    const tpl = '<div><%- include(\'yo\') %></div>';
    t.equal(compile(tpl, {include, filename: 'foo'})(), '<div><p>HELLO yo</p></div>');
    t.throws(() => compile(tpl, {include})(), /Found an include but filename or include option missing/);
    t.throws(() => compile(tpl, {filename: 'foo'})(), /Found an include but filename or include option missing/);
    t.end();
});
