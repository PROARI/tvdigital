// Configuración de Lista M3U Predeterminada de Dropbox
const DEFAULT_M3U_URL = "https://dl.dropbox.com/scl/fi/hj3xwhhhljekuijgc9de4/pando.m3u?rlkey=mjuqwqz5m5mpy0aem0q9c1ukv&st=flz3c65c&dl=1";

// Canales por defecto (Sincronizados del enlace M3U de Pando)
const DEFAULT_CHANNELS = [
    {
        id: "ch-pando-1",
        name: "SPC CANAL 15",
        category: "LOCALES",
        url: "https://live20.bozztv.com/giatv/giatv-1762252013SPC/1762252013SPC/chunks.m3u8",
        logo: "https://play-lh.googleusercontent.com/lrMtAr30CJPuCt-BHB_PrHkFIFZFDS5CaTi5-nt6EkjBjVre16CuLs-hTProo3WF6pJ5rBFWxGwcl_CR38HXWXU=w600-h300-pc0xffffff-pd",
        description: "Transmisión en vivo SPC CANAL 15."
    },
    {
        id: "ch-pando-2",
        name: "TVU PANDO",
        category: "LOCALES",
        url: "https://live20.bozztv.com/giatv/giatv-tvupandopro/tvupandopro/playlist.m3u8",
        logo: "https://scontent.flpb1-2.fna.fbcdn.net/v/t39.30808-6/327690229_894417668657300_977691807371883893_n.jpg?stp=dst-jpg_tt6&cstp=mx1134x1134&ctp=s1134x1134&_nc_cat=111&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=XJ6ulZuz6ioQ7kNvwEUVWWq&_nc_oc=AdrgfMyQ37-WDXzd03jim0vVNnNFscDP_ADa4Uh5fF4J86YfLEeMpDREjLaOYaXGMtjqW1Kh6ORLSd_PpJCfIsVC&_nc_zt=23&_nc_ht=scontent.flpb1-2.fna&_nc_gid=nSZj_ZXhpuPUB--FNSBnCg&_nc_ss=7b289&oh=00_AQH07_Btjd3_IkZaoup86-XvjicljwAahvuEudO5xHDfgA&oe=6A7BB5E8",
        description: "Transmisión en vivo TVU PANDO."
    },
    {
        id: "ch-pando-3",
        name: "LA PORTADAtv",
        category: "LOCALES",
        url: "https://live20.bozztv.com/giatv/giatv-laportadatvpandotv/laportadatvpandotv/chunks.m3u8",
        logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ9uTZxyQtVA_1ZH2pPF-AoleP9Uu0xUdIs4JUm8seC15CnABVKWsHdaaKJ&s=10",
        description: "Transmisión en vivo LA PORTADAtv."
    },
    {
        id: "ch-pando-4",
        name: "ESPECTACULAR tv",
        category: "LOCALES",
        url: "https://live20.bozztv.com/giatvplayout7/giatv-210534/playlist.m3u8",
        logo: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj4WJhhWCQAzZD-XKpk4rD5M1QwssSN7LnJSVzmwD71BjGhcxg2_BQu4X38ZJ05wwIFh2EmYcxwTZW2YSEx67cKq4jvwGc3v2MaVSYtcZpYB0Pt5Vu7S9V_6nWmXpwXuf1Z-7HDyCQVNaXNSjpNL3nW6yHidAvPlCu-uyp8TGawR2FdyVs3ZPMbV6xtJzc5/s512/cuadrado.jpg",
        description: "Transmisión en vivo ESPECTACULAR tv."
    },
    {
        id: "ch-pando-5",
        name: "CANTINAZO tv",
        category: "LOCALES",
        url: "https://live20.bozztv.com/giatvplayout7/giatv-210566/playlist.m3u8",
        logo: "https://www.appcreator24.com/srv/imgs/seccs/36312056_ico.png?ts=1786115203",
        description: "Transmisión en vivo CANTINAZO tv."
    }
];

/**
 * Parser M3U avanzado para listas IPTV
 */
function parseM3U(m3uText) {
    if (!m3uText) return [];
    const lines = m3uText.split(/\r?\n/);
    const channels = [];
    let currentChannel = null;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#EXTINF:')) {
            currentChannel = {};
            
            // Extraer tvg-logo
            const logoMatch = line.match(/tvg-logo=["']([^"']+)["']/i);
            if (logoMatch) currentChannel.logo = logoMatch[1];

            // Extraer group-title (Categoría)
            const groupMatch = line.match(/group-title=["']([^"']+)["']/i);
            if (groupMatch) currentChannel.category = groupMatch[1];

            // Extraer tvg-name
            const tvgNameMatch = line.match(/tvg-name=["']([^"']+)["']/i);

            // Nombre del canal (tras la última coma)
            const commaIndex = line.lastIndexOf(',');
            if (commaIndex !== -1) {
                currentChannel.name = line.substring(commaIndex + 1).trim();
            } else if (tvgNameMatch) {
                currentChannel.name = tvgNameMatch[1];
            } else {
                currentChannel.name = "Canal Sin Nombre";
            }
        } else if (!line.startsWith('#') && (line.startsWith('http://') || line.startsWith('https://') || line.includes('.m3u8') || line.includes('.mp4'))) {
            if (currentChannel) {
                currentChannel.url = line;
                currentChannel.id = 'ch-m3u-' + Math.abs(hashString(currentChannel.name + line));
                if (!currentChannel.logo) currentChannel.logo = 'logo.jpg';
                if (!currentChannel.category) currentChannel.category = 'LOCALES';
                channels.push(currentChannel);
                currentChannel = null;
            }
        }
    }
    return channels;
}

/**
 * Función auxiliar para generar IDs únicos basados en nombre y URL
 */
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return hash;
}
