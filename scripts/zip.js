// Empaquette le contenu de public/ dans un zip prêt à déployer.
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { version } = require('../package.json');

const sourceDir = path.join(__dirname, '..', 'public');
const outFile = path.join(__dirname, '..', `courses-v${version}.zip`);

if (!fs.existsSync(sourceDir)) {
    console.error(`Dossier introuvable : ${sourceDir}`);
    process.exit(1);
}

const output = fs.createWriteStream(outFile);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
    console.log(`${outFile} créé (${archive.pointer()} octets).`);
});

archive.on('error', (err) => { throw err; });
archive.pipe(output);

// Exclut les artefacts de stockage (ex: @eaDir généré par certains NAS Synology
// pour les miniatures) qui ne font pas partie du site et ne doivent pas être déployés.
const ignoredDirs = ['@eaDir', '#recycle', '.@__thumb'];
archive.directory(sourceDir, false, (entryData) => {
    if (entryData.name === 'index.html') return false; // injecté séparément ci-dessous, avec le cache-buster
    const firstSegment = entryData.name.split('/')[0];
    return ignoredDirs.includes(firstSegment) ? false : entryData;
});

// index.html référence son CSS/JS local avec `?v=CACHE_VERSION_PLACEHOLDER` (voir public/index.html)
// — un jeton valide tel quel dans une URL (contrairement à des `%%...%%`, que certains serveurs
// statiques, dont http-server utilisé par `npm run serve`/les tests, rejettent avec 400 Bad Request
// faute de former un pourcentage-encodage valide) donc le développement local n'est pas affecté tant
// que ce placeholder n'a pas été remplacé. Ce remplacement n'a lieu qu'ici, par un horodatage de
// build, pour que chaque zip déployé force les navigateurs (notamment Safari mobile, particulièrement
// agressif sur le cache de sites ajoutés à l'écran d'accueil) à retélécharger le CSS/JS plutôt que de
// servir une version obsolète en cache — sans ce mécanisme, un correctif déployé peut sembler "ne pas
// marcher" alors qu'il est bien en ligne.
const indexHtmlPath = path.join(sourceDir, 'index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8').replace(/CACHE_VERSION_PLACEHOLDER/g, Date.now());
archive.append(indexHtml, { name: 'index.html' });

archive.finalize();
