
const RE = /(<%%|%%>|<%=|<%-|<%_|<%#|<%|%>|-%>|_%>)/g;
const ESCAPE_RE = /[&<>'"]/g;
const BREAK_RE = /^(\r\n|\r|\n)/;
const W_LEFT_RE = /^[ \t]+(\r\n|\r|\n)/;
const W_RIGHT_RE = /[ \t]+$/;
const TPL_ESC_RE = /[\\`\r]|\$\{/g;
const INCLUDE_RE = /include\(\s*(['"])(.+?)\1\s*(,\s*({.+?})\s*)?\)/g;

const tplEscapes = /** @type {const} */ ({'\\': '\\\\', '`': '\\`', '\r': '\\r', '${': '\\${'});
/** @param {string} c */
const escapeTpl = c => tplEscapes[/** @type {keyof typeof tplEscapes} */ (c)];

const xmlEscapes = /** @type {const} */ ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '\'': '&apos;', '"': '&quot;'});
/** @param {string} c */
const escapeChar = c => xmlEscapes[/** @type {keyof typeof xmlEscapes} */ (c)];

const AsyncFunction = /** @type {FunctionConstructor} */ (/** @type {unknown} */ ((async () => {}).constructor));

/**
 * @typedef {Object} Options
 * @property {string} [localsName] Namespace for template data (default `'locals'`).
 * @property {string[]} [locals] Variables to access directly inside templates.
 * @property {unknown} [context] Value used as `this` in templates (default `null`).
 * @property {(value: string) => string} [escape] Custom escape function for `<%= ... %>` (defaults to XML-escaping).
 * @property {boolean} [async] Compile to an async function so `await` can be used (default `false`).
 * @property {string} [filename] Template file name, used to resolve includes.
 * @property {(filename: string) => string} [read] Reader for include contents.
 * @property {(parentPath: string | undefined, includePath: string) => string} [resolve] Include path resolver (defaults to identity on the include path).
 * @property {Record<string, string>} [cache] Cache of compiled include bodies (default `{}`).
 */

/**
 * @typedef {Options & Required<Pick<Options, 'escape' | 'localsName' | 'resolve' | 'cache'>>} ResolvedOptions
 */

/** @type {Required<Pick<Options, 'escape' | 'localsName' | 'resolve'>>} */
const defaultOptions = {
    escape: escapeXML,
    localsName: 'locals',
    resolve: (_, path) => path
};

/**
 * Compile an EJS template string into a render function.
 * @template {Options} [O = Options]
 * @param {string} ejs
 * @param {O} [options]
 * @returns {(data?: unknown) => O extends {async: true} ? Promise<string> : string}
 */
export function compile(ejs, options) {
    /** @type {ResolvedOptions} */
    const opts = {cache: {}, ...defaultOptions, ...options};
    const {escape, context, filename, localsName, async} = opts;

    const code = `'use strict'; ${compilePart(ejs, filename, opts)}`;
    let fn;
    try {
        fn = new (async ? AsyncFunction : Function)(localsName, '_esc', '_str', code);
    } catch (e) {
        const where = filename ? ` in ${filename}` : '';
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`Failed to compile template${where}: ${msg}\nGenerated code:\n${code}`, {cause: e});
    }

    return data => fn.call(context, data ?? null, escape, stringify);
}

/**
 * @param {string} ejs
 * @param {string | undefined} filename
 * @param {ResolvedOptions} options
 */
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
                if (open === '<%=' || open === '<%-') str = str.replace(/;\s*$/, '');
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
            prev === '<%' || prev === '<%_' ? '\n_out += `' : '';
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
        if (match) lastIndex = match.index + /** @type {string} */ (token).length;

    } while (match);

    code += '`; return _out;';

    return code;
}

/**
 * @param {string} js
 * @param {string | undefined} filename
 * @param {ResolvedOptions} options
 */
function compileIncludes(js, filename, options) {
    const {read, localsName, resolve, cache} = options;
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

/** @param {unknown} v */
function stringify(v) {
    return v == null ? '' : String(v);
}

/** @param {string} xml */
function escapeXML(xml) {
    return xml.replace(ESCAPE_RE, escapeChar);
}
