function timestamp(value) {
    const parts = value.split(':').map(Number);
    if (parts.length < 2 || parts.length > 3 || parts.some(part => !Number.isFinite(part))) return NaN;
    return parts.reduce((seconds, part) => seconds * 60 + part, 0);
}

// FFmpeg devuelve WebVTT; conservamos el texto, sin estilos ASS ni etiquetas HTML.
export function parseSubtitles(vtt) {
    return vtt.replace(/^\uFEFF/, '').replace(/\r/g, '').split(/\n\s*\n/).flatMap(block => {
        const lines = block.trim().split('\n');
        if (/^(WEBVTT|NOTE|STYLE|REGION)(\s|$)/.test(lines[0])) return [];
        const timingIndex = lines.findIndex(line => line.includes(' --> '));
        if (timingIndex < 0) return [];
        const match = lines[timingIndex].match(/^(\S+)\s+-->\s+(\S+)/);
        if (!match) return [];
        const start = timestamp(match[1]);
        const end = timestamp(match[2]);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
        const text = lines.slice(timingIndex + 1).join('\n').replace(/<[^>]*>/g, '')
            .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, entity) => ({
                amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '
            })[entity]);
        return [{ start, end, text }];
    });
}

export function subtitleAt(cues, time) {
    return cues.filter(cue => time >= cue.start && time < cue.end).map(cue => cue.text).join('\n');
}

export function trackLabel(track, position) {
    const languages = { spa: 'Español', es: 'Español', eng: 'Inglés', en: 'Inglés',
        fra: 'Francés', fre: 'Francés', fr: 'Francés', deu: 'Alemán', ger: 'Alemán', de: 'Alemán',
        ita: 'Italiano', it: 'Italiano', por: 'Portugués', pt: 'Portugués', jpn: 'Japonés', ja: 'Japonés',
        cat: 'Catalán', ca: 'Catalán', eus: 'Euskera', baq: 'Euskera', glg: 'Gallego' };
    const language = languages[track.language] || (track.language !== 'und' ? track.language : 'Sin idioma');
    return `${position + 1}. ${language}${track.title ? ` · ${track.title}` : ''}${track.isForced ? ' · Forzados' : ''}`;
}
