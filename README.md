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
| `/twitch/uptime/agonisingbasher` | estado do canal (e a duração, se ao vivo) | a cada 5 min, e de carona os endpoints de título/jogo **só quando ao vivo** |
| `/twitch/followcount/agonisingbasher` | contagem de seguidores | a cada 30 min |

Canal offline ≈ 14 requisições/hora; ao vivo ≈ 38. O throttle mora em `sessionStorage`, então
recarregar a página dez vezes em um minuto **não** emite requisição nova enquanto o cache tiver
menos de 60 s.

Regras que o código segue e que valem para qualquer edição futura:

- **Nada é afirmado sem validação.** Resposta que não casa com o padrão esperado (`is offline`,
  ou só dígitos) não pinta nada; duas falhas seguidas levam o badge a `Status indisponível`, que
  não diz online nem offline.
- **Título e jogo de uma stream antiga não são publicados.** Offline, eles ficam vazios. Um
  título velho num site que diz OFFLINE implicaria uma sessão que não existe.
- **Texto remoto entra por `textContent`.** O título da stream é controlado por terceiros.
- **Nenhum elemento é i18n-owned e poll-owned ao mesmo tempo.** Os três rótulos do badge
  (`AO VIVO` / `OFFLINE` / `Status indisponível`) têm `data-i18n` e são trocados por CSS conforme
  `html[data-live-state]`; o valor medido vive num span separado. `setLanguage()` não amassa
  número nenhum.
- O badge **não** é `aria-live`: polling de 5 min dentro de uma live region leria o número em voz
  alta a cada ciclo. O único `aria-live` do site é o status do formulário.

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

pt-BR e EN, com o motor i18n do portfólio (`script.js`). Duas coisas a respeitar ao editar:

- PT e EN são escritos **na mesma ordem de chaves**. Uma asserção no console avisa quando
  paridade quebrar (`[i18n] parity break`), e `resolveKey()` cai no PT antes de imprimir
  `undefined` — é assim que se corrige sem reintroduzir o bug antigo.
- Toda string visível vem do dicionário. O JS não injeta rótulo nenhum.

A chave de idioma é `agonisingbasher-twitch-language` e a de cache é `agonisingbasher-twitch-live`.
Os dois sites moram na **mesma origem** `agonisingbasher.github.io`, então nome próprio não é
capricho: do contrário o idioma de um vazaria para o outro.

## Identidade visual

A paleta foi medida por amostragem de pixels das artes do canal, não escolhida de memória:
ciano neon `#23DBF3` / `#1BEBFB` sobre navy `#1B2333`. O roxo da Twitch (`#9147FF`) aparece em
**um único lugar** — o botão Seguir, em `twitch.css:146` — e nunca em texto nem em banda clara.

As seções alternam dark e claro através de apelidos de papel (`--band-bg`, `--band-fg`,
`--band-accent`…) definidos em `style.css`. **O padrão é a banda clara**, então uma seção sem
classe de banda fica idêntica ao portfólio de hoje — é isso que protege o `feedback.css` copiado
sem edição. Os 9 tokens originais estão congelados; adicione nomes novos, não mude valores.

Breakpoints: `800/620/370` para o hub e `850/600` para o `feedback.css`. **Não unifique** — as
regras nunca se aplicam na mesma página, e a diferença é dívida deliberada.

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
Pages mandar o MIME correto. Ela não é enfeite: `live-status.js` põe `data-live-state` em
`<html>` e o CSS a usa como fundo a 22% de opacidade enquanto você está offline.

## O que está fora de propósito

Para alguém não "ajudar" depois: grade de streams, player embutido, Setup e regras do chat (v2),
e qualquer número de visualizações. **Views totais e contagem de VODs não existem na API
pública** — hoje o canal tem 0 VODs públicos — então nenhum dos dois pode aparecer como número
em lugar nenhum. Há um comentário no HTML marcando onde a grade entraria.

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
