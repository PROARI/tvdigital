// Canales predeterminados de televisión pública, streaming IPTV y transmisiones YouTube/DailyMotion
const DEFAULT_CHANNELS = [
    {
        id: "ch-1",
        name: "NASA TV HD (M3U8)",
        category: "Noticias",
        url: "https://ntv1.akamaized.net/hls/live/2014075/NASA-TV-v1/master.m3u8",
        logo: "https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg",
        description: "Transmisión oficial de la NASA en vivo desde el espacio."
    },
    {
        id: "ch-youtube-live",
        name: "DW Español YouTube Live",
        category: "Noticias",
        url: "https://www.youtube.com/watch?v=Nn_7vLh4Kkg",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_2012.svg/512px-Deutsche_Welle_2012.svg.png",
        description: "Canal internacional DW Noticias en vivo por YouTube."
    },
    {
        id: "ch-2",
        name: "France 24 Español",
        category: "Noticias",
        url: "https://static.france24.com/live/F24_ES_LO_HLS/live_tv.m3u8",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/France24.svg/512px-France24.svg.png",
        description: "Noticias internacionales las 24 horas en español."
    },
    {
        id: "ch-3",
        name: "DW Español Directo",
        category: "Noticias",
        url: "https://dwamdstream104.akamaized.net/hls/live/2015530/dwstream104/index.m3u8",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_2012.svg/512px-Deutsche_Welle_2012.svg.png",
        description: "Canal internacional de televisión alemana en español."
    },
    {
        id: "ch-4",
        name: "Red Bull TV",
        category: "Deportes",
        url: "https://rbmn-live.akamaized.net/hls/live/591070/geoBanned/master.m3u8",
        logo: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/Red_Bull_TV_logo.svg/512px-Red_Bull_TV_logo.svg.png",
        description: "Deportes extremos, eventos globales y cultura joven."
    },
    {
        id: "ch-5",
        name: "RTVE 24 Horas",
        category: "Noticias",
        url: "https://rtvelivestream.akamaized.net/rtvesec/24h/24h_main.m3u8",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Logo_RTVE.svg/512px-Logo_RTVE.svg.png",
        description: "Canal de noticias de Radio Televisión Española."
    },
    {
        id: "ch-6",
        name: "Canal Local En Vivo 1",
        category: "Locales",
        url: "https://demo.unified-streaming.com/k8s/live/stable/sintel.isml/sintel.m3u8",
        logo: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=200&auto=format&fit=crop&q=80",
        description: "Señal de televisión local experimental en alta definición."
    },
    {
        id: "ch-7",
        name: "Canal Local En Vivo 2",
        category: "Locales",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        logo: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=200&auto=format&fit=crop&q=80",
        description: "Señal regional local de entretenimiento continuo."
    },
    {
        id: "ch-8",
        name: "Euronews Español",
        category: "Noticias",
        url: "https://euronews-euronews-spanish-1-us.samsung.wurl.tv/playlist.m3u8",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Euronews_2016_logo.svg/512px-Euronews_2016_logo.svg.png",
        description: "Noticias del continente europeo en español."
    },
    {
        id: "ch-dailymotion",
        name: "Euronews DailyMotion Embed",
        category: "Noticias",
        url: "https://www.dailymotion.com/video/x7x4r7z",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Euronews_2016_logo.svg/512px-Euronews_2016_logo.svg.png",
        description: "Noticias internacionales por señal DailyMotion."
    },
    {
        id: "ch-9",
        name: "Cine Clásico en Vivo",
        category: "Cine",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        logo: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200&auto=format&fit=crop&q=80",
        description: "Transmisión continua de cine clásico y cortometrajes."
    },
    {
        id: "ch-10",
        name: "Música Chillout HD",
        category: "Música",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        logo: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&auto=format&fit=crop&q=80",
        description: "Sesión continua de música y paisajes visuales 4K."
    },
    {
        id: "ch-11",
        name: "Canal Infantil Demos",
        category: "Infantil",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        logo: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=200&auto=format&fit=crop&q=80",
        description: "Programación infantil y caricaturas en alta resolución."
    }
];
