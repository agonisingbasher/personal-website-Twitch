# AgonisingBasher — ambiente do canal

Página de entrada do canal: status da live, meta de seguidores, as portas para as plataformas
e a área de compras. **Não é um clone da Twitch e não embute player** — tudo que é da
plataforma abre num link externo.

Onde está o portfólio de projetos: [agonisingbasher.github.io/personal-website](https://agonisingbasher.github.io/personal-website/).

## Rodar localmente

Dois modos, e eles **não** são equivalentes:

```bash
cd "Web Site Agn Twitch"
python -m http.server 8000
# abre http://localhost:8000/
```

| Modo | Serve para | O que **não** funciona |
|---|---|---|
| Duplo-clique no `index.html` (`file://`) | layout, costura das bandas, larguras mobile, `?lang=` | o badge fica no fallback estático e o form não envia — é o comportamento projetado, não um bug |
| `python -m http.server` | tudo, inclusive o polling e o envio do feedback | — |

Sem build, sem dependências, sem passo de instalação. São arquivos planos.

## Como os números chegam à página

`live-status.js` lê texto puro do serviço público `decapi.me`, sem chave e sem backend:

| Endpoint | O que traz | Quando é chamado |
|---|---|---|
| `/twitch/uptime/agonisingbasher` | estado do canal (e a duração, se ao vivo) | a cada 5 min |
| `/twitch/title/agonisingbasher` | título da stream | no ciclo do uptime, **só quando ao vivo** |
| `/twitch/game/agonisingbasher` | categoria/jogo | idem |
| `/twitch/viewercount/agonisingbasher` | espectadores simultâneos | idem |
| `/twitch/followcount/agonisingbasher` | contagem de seguidores | a cada 30 min |

Cada ciclo emite 1 requisição offline e 4 ao vivo. Em uma hora de página aberta isso dá
**≈14/h offline** e **≈50/h ao vivo**, mais as 2/h da contagem de seguidores. O throttle mora em
`sessionStorage`, então recarregar a página dez vezes em um minuto **não** emite requisição nova
enquanto o cache tiver menos de 60 s.

A arte de fundo do estado AO VIVO não vem desses endpoints: é o preview público da Twitch,
`https://static-cdn.jtvnw.net/previews-ttv/live_user_agonisingbasher-640x360.jpg`, montado a partir
de uma constante do arquivo. Texto remoto nunca entra nessa URL, então não há o que injetar ali.

O `<script>` é servido com carimbo (`live-status.js?v=2026.10.31.3`). **Mexeu no `live-status.js`,
suba o carimbo no `index.html`** — o Pages cacheia o arquivo pelo nome, e sem isso cada visitante
fica com a versão antiga por tempo indeterminado.

Regras que o código segue e que valem para qualquer edição futura:

- **Nada é afirmado sem validação.** Resposta que não casa com o padrão esperado (`is offline`,
  ou só dígitos) não pinta nada; duas falhas seguidas levam o badge a `Status indisponível`, que
  não diz online nem offline.
- **Título e jogo de uma stream antiga não são publicados.** Offline, eles ficam vazios. Um
  título velho num site que diz OFFLINE implicaria uma sessão que não existe.
- **Texto remoto entra por `textContent`.** O título da stream é controlado por terceiros.
- **Número que não é número não pinta.** `viewercount` e `followcount` só são aceitos se a resposta
  inteira for dígitos (`^\d+$`) e o valor couber em `≤ 500000`; `N/A`, `12.5`, `-5` e
  `User not found: xyz` deixam o campo vazio ou mantêm o último valor válido.
- **Ir para offline limpa a duração.** O chip `#live-value` só se esconde quando está vazio, então
  `clearLiveMeta()` zera título, jogo, viewers, a própria duração e o `--ag-live-shot`. Sem isso o
  badge leria `OFFLINE 3h 4m 12s`.
- **Nenhum elemento é i18n-owned e poll-owned ao mesmo tempo.** Os três rótulos do badge
  (`AO VIVO` / `OFFLINE` / `Status indisponível`) têm `data-i18n` e são trocados por CSS conforme
  `html[data-live-state]`; o valor medido vive num span separado. `setLanguage()` não amassa
  número nenhum.
- O badge **não** é `aria-live`: polling de 5 min dentro de uma live region leria o número em voz
  alta a cada ciclo. O único `aria-live` do site é o status do formulário.

## OFFLINE e AO VIVO

Nada no hero se move quando o canal entra no ar. As três regras que garantem isso:

- **O slot de título/jogo/viewers é reservado.** O `<dl>` fica no fluxo com
  `visibility: hidden; opacity: 0` (twitch.css:224). `display: none` faria o hero crescer ~90 px no
  instante em que a live começasse. Cada `dd` é de linha única com `text-overflow: ellipsis`,
  então a altura do slot é a mesma nos dois estados e em qualquer largura — sem número mágico.
  Medido alternando `html[data-live-state]` em 320/392/480/620/768/831 px, inclusive com 120
  caracteres dentro dos `dd`: **Δ hero, Δ copy, Δ botões e Δ rodapé = 0 em todos**.
- **Os dois rótulos do botão moram no markup**, cada um com seu `data-i18n`; o estado só escolhe
  qual aparece (grid sobreposto, `grid-area: 1 / 1`), por isso a largura do botão é a mesma nos dois
  estados e o nó nunca fica i18n-owned *e* poll-owned ao mesmo tempo.
- **Quem some é o `visibility`, nunca o layout.** A transição do rótulo é
  `opacity .4s ease, visibility .4s` e a do slot `opacity .6s .25s, visibility .85s`, ambas dentro
  de `prefers-reduced-motion: no-preference`.

O badge AO VIVO é uma pílula vermelha sólida (`#c70e27`, mixes de `--ag-live-red`) com rótulo
`#fff1f2`: **5,42:1**. Vermelho saturado como *texto* de 11 px sobre o fundo escuro media 3,25:1 e
reprovava AA, e a pulsação antiga por opacidade levava esse par a 2,14:1 no vale da animação
(composto à mão a partir do `.72` do keyframe) — agora o que pulsa é um halo (`box-shadow`), e a
opacidade do rótulo fica 1.

Os fundos (`twitch.css:96-130`) usam **scrim dentro de `background-image`**, não `opacity` do
elemento: a arte do canal é clara (luminância média 0,67, pico 0,97) e uma opacidade baixa deixava a
copy sobre pixels claros. A legibilidade foi medida nó a nó — a rect de cada texto mapeada pela
geometria real `cover / center 38%`, composta sobre `#111820`, com `blur(15px)` simulado no fundo da
live e o **pior pixel** dentro da caixa de cada rótulo: 26 nós, mínimo **4,72:1 offline** e
**4,55:1 ao vivo**, todos acima do AA de 4,5:1 (3:1 para os dois títulos grandes).

## Feedback

O formulário e o destino são os mesmos do portfólio — `feedback-form.js` e `feedback.css` estão
aqui **byte-idênticos** aos originais. A separação entre as duas caixas acontece por dois campos
que a própria página envia:

- `Categoria` = `Site do canal`
- `page` = origem + caminho, calculados em runtime → `.../personal-website-Twitch/feedback.html`

Se um dia você quiser caixa separada de verdade, é **uma linha**: `FEEDBACK_ENDPOINT` em
`feedback-form.js:2`.

Antes de trocar qualquer coisa, saiba que estes IDs são referenciados por `getElementById` no
parser do script. Renomear um deles faz o JS morrer no parse e o formulário passa a fazer POST
nativo para lugar nenhum:

`feedback-form`, `feedback-status`, `feedback-progress`, `feedback-images`, `feedback-video`,
`feedback-language`, `feedback-category`, `feedback-category-value`, e o campo `name="website"`
(honeypot).

## Idioma

Quatro idiomas com dicionário escrito à mão — pt-BR, EN, ES e FR — no motor i18n do portfólio
(`script.js`). O seletor são quatro botões `.language-toggle` dentro de `.language-switch`: nada de
botão que cicla idioma, nada de link para o Google Translate. Duas coisas a respeitar ao editar:

- As quatro listas são escritas **na mesma ordem de chaves**. Uma asserção no console avisa quando
  paridade quebrar (`[i18n] paridade quebrada`), e `resolveKey()` cai no PT antes de imprimir
  `undefined` — é assim que se corrige sem reintroduzir o bug antigo.
- Toda string visível vem do dicionário. O JS não injeta rótulo nenhum.

A ordem de decisão é `?lang=` > `localStorage` > `navigator.languages` (com `navigator.language` de
reserva) > pt-BR. Qualquer `pt-*` colapsa em `pt-BR`, única variante portuguesa traduzida aqui; um
visitante com o navegador em espanhol ou francês já abre no idioma dele, e a escolha manual dele
passa a vencer na visita seguinte.

A chave de idioma é `agonisingbasher-twitch-language` e a de cache é `agonisingbasher-twitch-live`.
Os dois sites moram na **mesma origem** `agonisingbasher.github.io`, então nome próprio não é
capricho: do contrário o idioma de um vazaria para o outro.

## Identidade visual

A paleta foi medida por amostragem de pixels das artes do canal, não escolhida de memória:
ciano neon `#23DBF3` / `#1BEBFB` sobre navy `#1B2333`. O roxo da Twitch (`#9147FF`) aparece em
**um único lugar** — o botão Seguir, em `twitch.css:203` — e nunca em texto nem em banda clara.

As seções alternam dark e claro através de apelidos de papel (`--band-bg`, `--band-fg`,
`--band-accent`…) definidos em `style.css`. **O padrão é a banda clara**, então uma seção sem
classe de banda fica idêntica ao portfólio de hoje — é isso que protege o `feedback.css` copiado
sem edição. Os 9 tokens originais estão congelados; adicione nomes novos, não mude valores.

Breakpoints: `800/620/370` para o hub e `850/600` para o `feedback.css`. **Não unifique** — as
regras nunca se aplicam na mesma página, e a diferença é dívida deliberada.

## Meu Setup

Dois colunas (`twitch.css:270`), 16 linhas no total: **Configuração do PC** (10 itens) e
**Periféricos** (6), com um link de volta para a área de compras. O texto de cada valor é
**cópia exata do que o dono do canal escreveu** — nada de parafrasear, nada de especificação
inventada, nada de "melhorar" o nome comercial. Se um item mudar, troca-se a linha; se ele não
fornecer o dado, o item não entra.

Os rótulos (`Processador`, `Placa de vídeo`, `Mouse`…) vêm do dicionário i18n; os valores são
markup fixo, sem polling — máquina não muda sozinha no ar.

## Refazer o download das artes

Os três arquivos vêm de URLs com **hash de conteúdo**: no dia em que você reenviar a arte na
Twitch, o caminho antigo passa a dar 404 e o site quebra **sem mudança de código**. Rode isto
quando trocar a arte do canal:

```bash
cd assets
curl -o avatar-300x300.png              "<URL nova do avatar>"
curl -o profile-banner-480.jpeg         "<URL nova do banner>"
curl -o channel-offline-1920x1080.jpg   "<URL nova da arte offline>"
```

300×300 é o maior avatar que a Twitch serve (500×500 e `.jpeg` retornam 404). A arte offline é
JPEG de verdade mesmo quando a URL termina em `.png` — daí o sufixo `.jpg` aqui, para o GitHub
Pages mandar o MIME correto. Ela não é enfeite: `live-status.js` põe `data-live-state` em `<html>`
e o CSS a usa como fundo do hero sob um scrim vertical `#111820` (opacidade 0,88-0,97), trocando de
opacidade com o preview da live quando o canal entra no ar.

## O que está fora de propósito

Para alguém não "ajudar" depois: grade de streams, player embutido e regras do chat (v2),
e qualquer número de visualizações. **Views totais e contagem de VODs não existem na API
pública** — hoje o canal tem 0 VODs públicos — então nenhum dos dois pode aparecer como número
em lugar nenhum. Há um comentário no HTML marcando onde a grade entraria.

Também não volte a colocar a nav em `position: absolute` no celular: com 5 itens + toggle a linha
quebra em até 3 linhas (medido: 335 px de itens dentro de 277 px de container aos 320 px) e o header
sobreposto encostava no primeiro par do hero, com clearance de **-9 px**. Abaixo de 620 px ele entra
no fluxo (`twitch.css:316-318`) e o hero para de reservar altura — é por isso que não há número de
padding amarrado ao número de linhas da nav.

## Publicar

Deploy manual pelo GitHub Pages, sem Actions. O Pages serve o caminho **verbatim** e costuma dar
404 em vez de redirecionar quando a caixa muda; o repo existe como `personal-website-Twitch`
(com **T** maiúsculo). Depois do primeiro push, confirme qual variante responde 200:

```bash
curl -I https://agonisingbasher.github.io/personal-website-Twitch/
curl -I https://agonisingbasher.github.io/personal-website-twitch/
```

Em `Settings → Pages → Deploy from a branch`, escolha `main` / root — um repo vazio não ativa
sozinho.
