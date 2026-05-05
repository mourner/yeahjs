
const RE = /(<%%|%%>|<%=|<%-|<%_|<%#|<%|%>|-%>|_%>)/g;
const ESCAPE_RE = /[&<>'"]/g;
const BREAK_RE = /^(\r\n|\r|\n)/;
const W_LEFT_RE = /^[ \t]+(\r\n|\r|\n)/;
const W_RIGHT_RE = /[ \t]+$/;
const TPL_ESC_RE = /[\\`\r]|\$\{/g;
const INCLUDE_RE = /include\(\s*(['"])(.+?)\1\s*(,\s*({.+?})\s*)?\)/g;

const tplEscapes = {'\\': '\\\\', '`': '\\`', '\r': '\\r', '${': '\\${'};
const escapeTpl = c => tplEscapes[c];

const xmlEscapes = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '\'': '&apos;', '"': '&quot;'};
const escapeChar = c => xmlEscapes[c];

const AsyncFunction = (async () => {}).constructor;

const defaultOptions = {
    escape: escapeXML,
    localsName: 'locals',
    resolve: (_, path) => path
};

export function compile(ejs, options) {
    options = {cache: {}, ...defaultOptions, ...options};
    const {escape, localsName, context, filename, async} = options;

    const code = `'use strict'; ${compilePart(ejs, filename, options)}`;
    const fn = new (async ? AsyncFunction : Function)(localsName, '_esc', '_str', code);

    return data => fn.call(context, data ?? null, escape, stringify);
}

function compilePart(ejs, filename, options) {
    const {locals, localsName} = options;
    let code = locals?.length ? `const {${locals.join(', ')}} = ${localsName}; ` : '';
    code += 'let _out = `';

    const tokens = ejs.matchAll(RE);
    let lastIndex = 0;
    let match, prev, open;

    do {
        match = tokens.next().value;
        const token = match && match[0];

        if (prev !== '<%#') {
            let str = ejs.slice(lastIndex, match ? match.index : undefined);
            if (!open) { // text data
                if (token === '<%_') str = str.replace(W_RIGHT_RE, '');
                if (prev === '_%>') str = str.replace(W_LEFT_RE, '');
                else if (prev === '-%>') str = str.replace(BREAK_RE, '');

                code += str.replace(TPL_ESC_RE, escapeTpl);

            } else { // JS
                code += compileIncludes(str, filename, options);
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
        if (match) lastIndex = match.index + token.length;

    } while (match);

    code += '`; return _out;';

    return code;
}

function compileIncludes(js, filename, options) {
    const {read, resolve, cache, localsName} = options;
    let code = '';
    let lastIndex = 0;

    for (const match of js.matchAll(INCLUDE_RE)) {
        const [, , includePath, , includeData] = match;
        if (!read) throw new Error(`Found an include but read option missing: ${includePath}`);

        const key = resolve(filename, includePath);
        cache[key] ??= compilePart(read(key), key, options);
        const includeLocals = includeData ? `Object.assign(Object.create(${localsName}), ${includeData})` : '';

        code += `${js.slice(lastIndex, match.index)}((${includeLocals ? localsName : ''}) => { ${cache[key]} })(${includeLocals})`;
        lastIndex = match.index + match[0].length;
    }

    return code + js.slice(lastIndex);
}

function stringify(v) {
    return v == null ? '' : String(v);
}

function escapeXML(xml) {
    return xml.replace(ESCAPE_RE, escapeChar);
}
