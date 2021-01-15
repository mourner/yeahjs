
import fs from 'fs';
import {test} from 'tape';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

import {compile} from '../index.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

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
    function resolve(parent, filename) {
        t.equal(parent, 'foo', 'resolve parent');
        t.equal(filename, 'yo', 'resolve filename');
        return filename;
    }
    function read(filename) {
        return `<p><%= "HELLO ${filename}" %></p>`;
    }

    const tpl = '<div><%- include(\'yo\') %></div>';
    const filename = 'foo';
    const cache = {};
    t.equal(compile(tpl, {resolve, read, filename, cache})(), '<div><p>HELLO yo</p></div>', 'include');
    t.equal(JSON.stringify(cache), '{"yo":"let _out = `<p>` + _esc(_str( \\"HELLO yo\\" \\n)) + `</p>`; return _out;"}', 'cache');

    t.throws(() => compile(tpl, {})(), /Found an include but read option missing/, 'missing option');

    t.end();
});

test('includes in node', (t) => {
    const read = file => fs.readFileSync(file, 'utf8');
    const resolve = (parent, file) => join(dirname(parent), file);

    const indexFile = join(fixturesDir, 'index.ejs');
    const index = compile(fs.readFileSync(indexFile, 'utf8'), {read, resolve, filename: indexFile});
    t.equal(index(), '<p>(c) Vladimir Agafonkin</p>\n\n<h1>Oh my</h1>\n\n<h2>Hello</h2>\n', 'node resolve');

    const postFile = join(fixturesDir, 'posts/post.ejs');
    const post = compile(fs.readFileSync(postFile, 'utf8'), {read, resolve, filename: postFile});
    t.equal(post(), '<p>(c) Vladimir Agafonkin</p>\n\n<h1>Oh my</h1>\n\n<p>Lorem ipsum</p>\n', 'node resolve 2');

    t.end();
});

test('async', async (t) => {
    t.equal(await compile('<%= await 0 %>', {async: true})(), '0', 'await');
    t.throws(() => compile('<% await 0 %>')(), /await is only valid in async function/, 'async error');
});
