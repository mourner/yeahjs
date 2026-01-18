
import fs from 'fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {compile} from '../index.js';

const users = [{name: 'Vlad'}, {name: 'Masha'}, {name: 'Dasha'}];

test('empty', () => {
    assert.equal(compile('')(), '', 'empty');
    assert.equal(compile('<p>')(), '<p>', 'no tags');
});

test('<%= %>', () => {
    assert.equal(compile('<p><%= locals.foo %></p>')({foo: 'bar'}), '<p>bar</p>', 'locals');
    assert.equal(compile('<%= locals.name %>')({name: '&nbsp;<script>\'s'}), '&amp;nbsp;&lt;script&gt;&apos;s', 'escape');
    assert.equal(compile('<%= undefined %>')(), '', 'undefined');
    assert.equal(compile('<%= null %>')(), '', 'null');
    assert.equal(compile('<%= 0 %>')(), '0', '0');
    assert.equal(compile('<%= // a comment\nlocals.name // another comment %>')({name: '&nbsp;<script>'}), '&amp;nbsp;&lt;script&gt;', 'comment');
    assert.throws(() => compile('<h1>oops</h1><%= name ->'), /Could not find matching close tag for <%=/, 'close tag error');

});

test('<%- %>', () => {
    assert.equal(compile('<%-\n// a comment\nlocals.name\n// another comment %>')({name: '&nbsp;<script>'}), '&nbsp;<script>', 'no escape');
    assert.equal(compile('<%- undefined %>')(), '', 'undefined');
    assert.equal(compile('<%- null %>')(), '', 'null');
    assert.equal(compile('<%- 0 %>')(), '0', '0');
    assert.throws(() => compile('<h1>oops</h1><%- name ->'), /Could not find matching close tag for <%-/, 'close tag error');

    const tpl = '<ul><% -%>\r\n<% locals.users.forEach(function(user){ -%>\r\n<li><%= user.name -%></li>\r\n<% }) -%>\r\n</ul><% -%>\r\n';
    assert.equal(compile(tpl)({users}), '<ul><li>Vlad</li>\r\n<li>Masha</li>\r\n<li>Dasha</li>\r\n</ul>', 'windows line breaks');
});

test('%>, -%>', () => {
    assert.equal(compile(`<ul>
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
    assert.equal(compile('<% var a = \'foo\' %><% var b = \'bar\' %><%= a %>')(), 'foo', 'consecutive');
    assert.equal(compile(`<ul>
  <% locals.users.forEach(function(user){ -%>
  <li><%= user.name %></li>
  <% }) -%>
</ul>`)({users}), `<ul>
    <li>Vlad</li>
    <li>Masha</li>
    <li>Dasha</li>
  </ul>`, 'strip line ending');
});

test('<%_, _%>', () => {
    const tpl = '<ul>\n\t<%_ locals.users.forEach(function(user){ _%>\t\n    <li><%= user.name %></li>\n\t<%_ }) _%> \t\n</ul>';
    assert.equal(compile(tpl)({users}), `<ul>
    <li>Vlad</li>
    <li>Masha</li>
    <li>Dasha</li>
</ul>`, 'strip whitespace');
});

test('<%%, %%>', () => {
    assert.equal(compile('<%%- "foo" %>')(), '<%- "foo" %>', 'left literal');
    assert.equal(compile('<%%-')(), '<%-', 'left literal alone');
    assert.equal(compile('%%>')(), '%>', 'right literal');
});

test('<% %>', () => {
    assert.equal(compile(`<%
      var a = 'b'
      var b = 'c'
      var c
      c = b
    %><%= c %>`)(), 'c', 'no semicolons');
    assert.throws(() => compile('<% function foo() return \'foo\'; %>'), 'syntax error');
});

test('characters', () => {
    assert.equal(compile('<p><%= \'Vlad\' %>\'s guitar</p>')(), '<p>Vlad\'s guitar</p>', 'single quote');
    assert.equal(compile('<p><%= "Vl" + \'ad\' %>\'s "guitar"</p>')(), '<p>Vlad\'s "guitar"</p>', 'double quote');
    assert.equal(compile(String.raw`\foo`)(), String.raw`\foo`, 'backslash');
    assert.equal(compile('<ul><%locals.users.forEach(function(user){%><li><%=user.name%></li><%})%></ul>')({users}),
        '<ul><li>Vlad</li><li>Masha</li><li>Dasha</li></ul>', 'no whitespace');
    assert.equal(compile(String.raw`<%= "<p>foo</p>".match(/\<p>(.+)<\/p>/)[1] %>`)(), 'foo', 'regexps');
    /* eslint-disable no-template-curly-in-string */
    assert.equal(compile('const greeting = `Hello ${<%- JSON.stringify(locals.name) %>}!`;')({name: 'Alice'}),
        'const greeting = `Hello ${"Alice"}!`;', 'backticks and placeholders');
    assert.equal(compile('`backtick` and ${placeholder}')(), '`backtick` and ${placeholder}', 'literal backticks and placeholders');
    /* eslint-enable no-template-curly-in-string */
});

test('options', () => {
    assert.equal(compile('<%= data.foo %>', {localsName: 'data'})({foo: 5}), '5', 'localsName');
    assert.equal(compile('<%= foo %>', {locals: ['foo']})({foo: 5}), '5', 'locals');
    assert.equal(compile('<%= this.foo %>', {context: {foo: 5}})(), '5', 'context');
    const escape = str => (!str ? '' : str.toUpperCase());
    assert.equal(compile('<%= locals.name %>', {escape})({name: 'Vlad\'s'}), 'VLAD\'S', 'escape');
});

test('includes', () => {
    function resolve(parent, filename) {
        assert.equal(parent, 'foo', 'resolve parent');
        assert.equal(filename, 'yo', 'resolve filename');
        return filename;
    }
    function read(filename) {
        return `<p><%= "HELLO ${filename}" %></p>`;
    }

    const tpl = '<div><%- include(\'yo\') %></div>';
    const filename = 'foo';
    const cache = {};
    assert.equal(compile(tpl, {resolve, read, filename, cache})(), '<div><p>HELLO yo</p></div>', 'include');
    assert.equal(JSON.stringify(cache), '{"yo":"let _out = `<p>` + _esc(_str( \\"HELLO yo\\" \\n)) + `</p>`; return _out;"}', 'cache');

    assert.throws(() => compile(tpl, {})(), /Found an include but read option missing/, 'missing option');

});

test('includes in node', () => {
    const read = file => fs.readFileSync(file, 'utf8');
    const resolve = (parent, file) => new URL(file, parent);

    const indexFile = new URL('./fixtures/index.ejs', import.meta.url);
    const index = compile(fs.readFileSync(indexFile, 'utf8'), {read, resolve, filename: indexFile});
    assert.equal(index(), '<p>(c) Vladimir Agafonkin</p>\n\n<h1>Oh my</h1>\n\n<h2>Hello</h2>\n', 'node resolve');

    const postFile = new URL('./fixtures/posts/post.ejs', import.meta.url);
    const post = compile(fs.readFileSync(postFile, 'utf8'), {read, resolve, filename: postFile});
    assert.equal(post(), '<p>(c) Vladimir Agafonkin</p>\n\n<h1>Oh my</h1>\n\n<p>Lorem ipsum</p>\n', 'node resolve 2');

});

test('async', async () => {
    assert.equal(await compile('<%= await 0 %>', {async: true})(), '0', 'await');
    assert.throws(() => compile('<% await 0 %>')(), /await is only valid in async function/, 'async error');
});
