'use strict';

exports.compile = compile;

const RE = /(<%%|%%>|<%=|<%-|<%_|<%#|<%|%>|-%>|_%>)/gm;
const BREAK_RE = /^(\r\n|\r|\n)/;
const ESCAPE_RE = /[&<>'"]/gm;
const W_LEFT_RE = /^[ \t]+/;
const W_RIGHT_RE = /[ \t]+$/;

const defaultOptions = {
    escape: escapeXML,
    localsName: 'locals',
    locals: []
};

function compilePart(ejs) {
    let match, prev, open;
    let lastIndex = 0;

    let code = '_out += `';
    RE.lastIndex = 0;
    do {
        match = RE.exec(ejs);
        const token = match && match[0];

        if (prev !== '<%#') {
            let str = ejs.slice(lastIndex, match ? match.index : undefined);

            if (token === '<%_') str = str.replace(W_RIGHT_RE, '');
            if (prev === '_%>') str = str.replace(W_LEFT_RE, '');
            if (prev === '-%>' || prev === '_%>') str = str.replace(BREAK_RE, '');
            if (!open) {
                str = str.replace('\\', '\\\\');
                str = str.replace('\r', '\\r');
            }
            code += str;
        }

        if (!token || token[0] === '<' && token[2] !== '%') {
            if (open) throw new Error(`Could not find matching close tag for ${open}.`);
            open = token;
        }

        switch (token) {
        case '%>':
        case '_%>':
        case '-%>': code +=
            prev === '<%=' ||
            prev === '<%-' ? '\n)) + `' :
            prev === '<%' ||
            prev === '<%_' ? '\n_out += `' :
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

    code += '`;';

    return code;
}

function compile(ejs, options = {}) {
    const {escape, locals, localsName, context} = Object.assign({}, defaultOptions, options);

    let code = '\'use strict\'; ';
    if (locals && locals.length) code += `const {${locals.join(', ')}} = ${localsName}; `;
    code += `let _out = ''; ${compilePart(ejs)} return _out;`;

    const fn = new Function(localsName, '_esc', '_str', code);
    return data => fn.call(context, data, escape, stringify);
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
