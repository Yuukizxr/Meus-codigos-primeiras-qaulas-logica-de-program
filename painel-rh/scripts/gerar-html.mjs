// Gera dist/PainelRH.html: um único arquivo com HTML, CSS, JS, ícones e fontes embutidos.
// Abre com dois cliques no Edge/Chrome, sem instalar nada e sem internet.
// Uso: npm run build:html
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => join(raiz, 'src', p);

const js = await build({
  entryPoints: [src('js/main.js')], bundle: true, format: 'iife', minify: true,
  target: 'es2020', legalComments: 'none', write: false,
});
const css = await build({
  entryPoints: [src('css/app.css')], bundle: true, minify: true,
  loader: { '.woff2': 'dataurl' }, write: false,
});
const codigo = js.outputFiles[0].text;
const estilo = css.outputFiles[0].text;
if (/<\/script/i.test(codigo) || /<\/style/i.test(estilo)) throw new Error('Conteúdo quebraria o HTML.');

// Política de segurança: a página não consegue acessar a internet (connect-src 'none').
const csp = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'";

let html = readFileSync(src('index.html'), 'utf8');
const trocar = (de, para) => {
  if (!html.includes(de)) throw new Error(`Trecho não encontrado em index.html: ${de}`);
  html = html.replace(de, () => para);
};
trocar('<meta charset="utf-8">', `<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`);
trocar('<link rel="stylesheet" href="css/app.css">', `<style>${estilo}</style>`);
trocar('<script type="module" src="js/main.js"></script>', '');
trocar('</body>', `<script>${codigo}</script>\n</body>`);

mkdirSync(join(raiz, 'dist'), { recursive: true });
const saida = join(raiz, 'dist', 'PainelRH.html');
writeFileSync(saida, html);
console.log(`Gerado ${saida} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
