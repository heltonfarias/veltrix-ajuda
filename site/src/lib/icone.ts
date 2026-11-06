import * as lucide from 'lucide-static';

const pascal = (s: string) => s.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');

/** SVG inline de um ícone lucide pelo nome em kebab-case ("shopping-cart"). */
export function icone(nome: string, tamanho = 16, classe = ''): string {
  const svg = (lucide as unknown as Record<string, string>)[pascal(nome)] ?? (lucide as unknown as Record<string, string>).BookOpen;
  return svg
    .replace(/width="24"/, `width="${tamanho}"`)
    .replace(/height="24"/, `height="${tamanho}"`)
    .replace(/class="([^"]*)"/, `class="$1 ${classe}" aria-hidden="true"`);
}
