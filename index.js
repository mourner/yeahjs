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

function compile(ejs, options = {}) {
    const {escape, locals, localsName, context} = Object.assign({}, defaultOptions, options);

    let match, prev, open;
    let lastIndex = 0;
    const out = '_out';
    let code = '\'use strict\'; ';
    if (locals && locals.length) code += `const {${locals.join(', ')}} = ${localsName}; `;

    code += `let ${out} = \``;
    do {
        match = RE.exec(ejs);
        const token = match && match[0];

        let str = ejs.slice(lastIndex, match ? match.index : undefined);
        if (token === '<%_') str = str.replace(W_RIGHT_RE, '');
        if (prev === '_%>') str = str.replace(W_LEFT_RE, '');
        if (prev === '-%>' || prev === '_%>') str = str.replace(BREAK_RE, '');

        if (prev !== '<%#') code += str
            .replace('\\', '\\\\')
            .replace('\r', '\\r');

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
            prev === '<%_' ? `\n${out} += \`` :
            prev === '<%#' ? '' : token;
            open = null;
            break;
        case '<%':
        case '<%_': code += '`;'; break;
        case '<%=': code += '` + _escape(_str('; break;
        case '<%-': code += '` + _str(('; break;
        case '<%%': code += '<%'; break;
        case '%%>': code += '%>';
        }

        prev = token;
        lastIndex = RE.lastIndex;

    } while (match);

    code += `\`; return ${out};`;
    RE.lastIndex = 0;

    // console.log(code);
    const fn = new Function(localsName, '_escape', '_str', code);
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
