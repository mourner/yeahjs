'use strict';

exports.compile = compile;

const RE = /(<%%|%%>|<%=|<%-|<%_|<%#|<%|%>|-%>|_%>)/g;
const ESCAPE_RE = /[&<>'"]/g;
const BREAK_RE = /^(\r\n|\r|\n)/;
const W_LEFT_RE = /^[ \t]+(\r\n|\r|\n)/;
const W_RIGHT_RE = /[ \t]+$/;
const INCLUDE_RE = /include\(\s*(['"])([^\1]*)\1\s*\)/g;

const defaultOptions = {
    escape: escapeXML,
    localsName: 'locals',
    resolve: (parent, path) => path
};

let AsyncFunction;
try { AsyncFunction = (new Function('return (async () => {}).constructor;'))(); } catch (e) { /* ignore */ }

function compile(ejs, options = {}) {
    const {escape, locals, localsName, context, filename, read, resolve, cache, async} =
        Object.assign({}, defaultOptions, options);

    if (async && !AsyncFunction) throw new Error('This environment does not support async/await.');

    let code = '\'use strict\'; ';
    if (locals && locals.length) code += `const {${locals.join(', ')}} = ${localsName}; `;
    code += compilePart(ejs, filename, read, resolve, cache || {});

    const fn = new (async ? AsyncFunction : Function)(localsName, '_esc', '_str', code);
    return data => fn.call(context, data, escape, stringify);
}

function compilePart(ejs, filename, read, resolve, cache) {
    const originalLastIndex = RE.lastIndex;
    let lastIndex = RE.lastIndex = 0;
    let code = 'let _out = `';
    let match, prev, open;
    do {
        match = RE.exec(ejs);
        const token = match && match[0];

        if (prev !== '<%#') {
            let str = ejs.slice(lastIndex, match ? match.index : undefined);
            if (!open) { // text data
                if (token === '<%_') str = str.replace(W_RIGHT_RE, '');
                if (prev === '_%>') str = str.replace(W_LEFT_RE, '');
                else if (prev === '-%>') str = str.replace(BREAK_RE, '');

                code += str.replace('\\', '\\\\').replace('\r', '\\r');

            } else { // JS
                code += compileIncludes(str, filename, read, resolve, cache);
            }
        }

        if (!token || token[0] === '<' && token[2] !== '%') {
            if (open) throw new Error(`Could not find matching close tag for ${open}.`);
            open = token;
        }

        switch (token) {
        case '%>':
        case '_%>':
        case '-%>': code +=
            prev === '<%=' || prev === '<%-' ? '\n)) + `' :
            prev === '<%' || prev === '<%_' ? '\n_out += `' :
            prev === '<%#' ? '' : token;
            open = null;
            break;
        case '<%':
        case '<%_': code += '`;'; break;
        case '<%=': code += '` + _esc(_str('; break;
        case '<%-': code += '` + _str(('; break;
        case '<%%': code += '<%'; break;
        case '%%>': code += '%>';
        }

        prev = token;
        lastIndex = RE.lastIndex;

    } while (match);

    code += '`; return _out;';
    RE.lastIndex = originalLastIndex;

    return code;
}

function compileIncludes(js, filename, read, resolve, cache) {
    const originalLastIndex = INCLUDE_RE.lastIndex;
    let lastIndex = INCLUDE_RE.lastIndex = 0;
    let code = '';
    let match;
    while ((match = INCLUDE_RE.exec(js)) !== null) {
        const includePath = match[2];
        if (!read) throw new Error(`Found an include but read option missing: ${includePath}`);

        const key = resolve(filename, includePath);
        const includeCode = cache[key] = cache[key] || compilePart(read(key), key, read, resolve, cache);

        code += `${js.slice(lastIndex, match.index)}(() => { ${includeCode} })()`;

        lastIndex = INCLUDE_RE.lastIndex;
    }
    code += js.slice(lastIndex);
    INCLUDE_RE.lastIndex = originalLastIndex;
    return code;
}

function stringify(v) {
    return v === null || v === undefined ? '' : String(v);
}

const escapeChar = c => (
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;' :
    c === '>' ? '&gt;' :
    c === '\'' ? '&apos;' :
    c === '"' ? '&quot;' : c);

function escapeXML(xml) {
    return xml && xml.replace(ESCAPE_RE, escapeChar);
}
