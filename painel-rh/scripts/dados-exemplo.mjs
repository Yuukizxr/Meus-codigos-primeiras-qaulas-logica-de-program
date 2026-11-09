// Gera um dados.json de exemplo (20 rescisões) para medir a RAM com conteúdo realista.
// Uso: node scripts/dados-exemplo.mjs <pasta-destino>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const pasta = process.argv[2];
if (!pasta) { console.error('Informe a pasta de destino.'); process.exit(1); }
const hoje = new Date();
const dia = (n) => {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + n, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const status = ['pendente', 'pendente', 'pendente', 'solicitada', 'paga'];
const rescisoes = Array.from({ length: 20 }, (_, i) => ({
  id: `ex${i}`,
  nome: `Funcionário Exemplo ${i + 1}`,
  dataCarta: dia(-40 + i * 3),
  tipo: i % 2 ? 'indenizado' : 'trabalhado',
  status: status[i % status.length],
  manual: {},
}));
mkdirSync(pasta, { recursive: true });
writeFileSync(join(pasta, 'dados.json'), JSON.stringify({ versao: 1, config: {}, feriadosLocais: [], rescisoes, ferias: [] }, null, 2));
console.log(`Exemplo gravado em ${join(pasta, 'dados.json')}`);
