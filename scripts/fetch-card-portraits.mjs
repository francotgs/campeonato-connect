import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const ROOT = new URL("..", import.meta.url);
const CATALOG_PATH = new URL("../packages/cards/src/catalog.json", import.meta.url);
const OUTPUT_DIR = new URL("../apps/web/public/cards/players/", import.meta.url);
const CREDITS_PATH = new URL("../apps/web/public/cards/players/_credits.json", import.meta.url);
const MANIFEST_PATH = new URL("../apps/web/src/lib/cardPortraits.ts", import.meta.url);
const USER_AGENT = "campeonato-connect-card-assets/1.0 (local event app)";

const TITLE_OVERRIDES = {
  mbappe: "Kylian Mbappé",
  dembele: "Ousmane Dembélé",
  saliba: "William Saliba",
  maignan: "Mike Maignan",
  rodri: "Rodri (footballer, born 1996)",
  pedri: "Pedri",
  lamine_yamal: "Lamine Yamal",
  carvajal: "Dani Carvajal",
  messi: "Lionel Messi",
  lautaro: "Lautaro Martínez",
  mac_allister: "Alexis Mac Allister",
  emiliano_martinez: "Emiliano Martínez",
  bellingham: "Jude Bellingham",
  kane: "Harry Kane",
  saka: "Bukayo Saka",
  stones: "John Stones",
  bruno_fernandes: "Bruno Fernandes",
  vitinha: "Vitinha (footballer, born February 2000)",
  rafael_leao: "Rafael Leão",
  ruben_dias: "Rúben Dias",
  vinicius: "Vinícius Júnior",
  raphinha: "Raphinha",
  marquinhos: "Marquinhos",
  alisson: "Alisson Becker",
  van_dijk: "Virgil van Dijk",
  frenkie_de_jong: "Frenkie de Jong",
  gakpo: "Cody Gakpo",
  courtois: "Thibaut Courtois",
  de_bruyne: "Kevin De Bruyne",
  doku: "Jérémy Doku",
  wirtz: "Florian Wirtz",
  musiala: "Jamal Musiala",
  rudiger: "Antonio Rüdiger",
  donnarumma: "Gianluigi Donnarumma",
  barella: "Nicolò Barella",
  bastoni: "Alessandro Bastoni",
  gvardiol: "Joško Gvardiol",
  modric: "Luka Modrić",
  hakimi: "Achraf Hakimi",
  bounou: "Yassine Bounou",
  luis_diaz: "Luis Díaz (footballer, born 1997)",
  davinson_sanchez: "Davinson Sánchez",
  mane: "Sadio Mané",
  koulibaly: "Kalidou Koulibaly",
  santiago_gimenez: "Santiago Giménez",
  edson_alvarez: "Edson Álvarez",
  luis_malagon: "Luis Malagón",
  pulisic: "Christian Pulisic",
  antonee_robinson: "Antonee Robinson",
  mckennie: "Weston McKennie",
};

const MIME_EXT = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  await rm(OUTPUT_DIR, { force: true, recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  const credits = {};
  const failures = [];

  for (const card of catalog) {
    const key = card.art.portraitKey;
    try {
      const title = TITLE_OVERRIDES[key] ?? card.name;
      const page = await getWikipediaPage(title);
      if (!page?.pageimage) throw new Error(`no page image for ${title}`);

      const image = await getCommonsImageInfo(page.pageimage);
      const imageUrl = image.thumburl ?? image.url;
      if (!imageUrl) throw new Error(`no image url for ${page.pageimage}`);

      const response = await fetchWithRetry(imageUrl);
      if (!response.ok) throw new Error(`download failed ${response.status}`);
      const contentType = response.headers.get("content-type")?.split(";")[0] ?? image.mime;
      const ext = MIME_EXT.get(contentType) ?? extname(new URL(imageUrl).pathname) ?? ".jpg";
      const filename = `${key}${ext}`;
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(new URL(filename, OUTPUT_DIR), buffer);

      credits[key] = {
        player: card.name,
        country: card.country,
        src: `/cards/players/${filename}`,
        pageTitle: page.title,
        pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`,
        fileTitle: page.pageimage,
        fileUrl: image.descriptionurl ?? null,
        author: cleanMetadata(image.extmetadata?.Artist?.value),
        credit: cleanMetadata(image.extmetadata?.Credit?.value),
        license: cleanMetadata(image.extmetadata?.LicenseShortName?.value),
        licenseUrl: cleanMetadata(image.extmetadata?.LicenseUrl?.value),
      };

      console.log(`ok ${key}: ${filename} (${Math.round(buffer.length / 1024)} KB)`);
      await sleep(900);
    } catch (error) {
      failures.push({ key, player: card.name, error: error.message });
      console.error(`fail ${key}: ${error.message}`);
    }
  }

  await writeFile(CREDITS_PATH, `${JSON.stringify(credits, null, 2)}\n`, "utf8");
  await writeFile(MANIFEST_PATH, buildManifestSource(credits), "utf8");

  if (failures.length > 0) {
    console.error("\nMissing portraits:");
    for (const failure of failures) {
      console.error(`- ${failure.key} (${failure.player}): ${failure.error}`);
    }
    process.exitCode = 1;
  }
}

async function getWikipediaPage(title) {
  const page = await queryWikipedia({
    action: "query",
    prop: "pageimages",
    piprop: "name",
    redirects: "1",
    titles: title,
  });
  const found = firstPage(page);
  if (found?.pageimage) return found;

  const search = await queryWikipedia({
    action: "query",
    list: "search",
    srlimit: "1",
    srsearch: `${title} footballer`,
  });
  const searchTitle = search.query?.search?.[0]?.title;
  if (!searchTitle) return found;

  const searched = await queryWikipedia({
    action: "query",
    prop: "pageimages",
    piprop: "name",
    redirects: "1",
    titles: searchTitle,
  });
  return firstPage(searched);
}

async function getCommonsImageInfo(filename) {
  const data = await queryCommons({
    action: "query",
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "480",
    titles: `File:${filename}`,
  });
  const page = firstPage(data);
  const info = page?.imageinfo?.[0];
  if (!info) throw new Error(`no Commons info for ${filename}`);
  return info;
}

async function queryWikipedia(params) {
  return queryApi("https://en.wikipedia.org/w/api.php", params);
}

async function queryCommons(params) {
  return queryApi("https://commons.wikimedia.org/w/api.php", params);
}

async function queryApi(endpoint, params) {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries({
    format: "json",
    origin: "*",
    ...params,
  })) {
    url.searchParams.set(key, value);
  }
  const response = await fetchWithRetry(url);
  if (!response.ok) throw new Error(`API failed ${response.status}: ${url}`);
  return response.json();
}

async function fetchWithRetry(url) {
  let lastResponse;
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Api-User-Agent": USER_AGENT,
      },
    });
    if (response.status !== 429) return response;
    lastResponse = response;
    const retryAfter = Number(response.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 10_000 * (attempt + 1));
  }
  return lastResponse;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function firstPage(data) {
  const pages = data.query?.pages;
  if (!pages) return null;
  return Object.values(pages)[0] ?? null;
}

function cleanMetadata(value) {
  if (!value) return null;
  return String(value)
    .replaceAll(/<[^>]*>/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function buildManifestSource(credits) {
  const entries = Object.entries(credits)
    .map(([key, credit]) => `  ${JSON.stringify(key)}: ${JSON.stringify(credit.src)},`)
    .join("\n");

  return `export const CARD_PORTRAIT_SOURCES = {\n${entries}\n} as const;\n\nexport function getCardPortraitSrc(portraitKey: string): string | null {\n  return CARD_PORTRAIT_SOURCES[portraitKey as keyof typeof CARD_PORTRAIT_SOURCES] ?? null;\n}\n`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
