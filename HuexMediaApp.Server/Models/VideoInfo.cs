namespace HuexMediaApp.Server.Models
{
    public class VideoInfo
    {
        // VideoInfo: almacenar códecs, resolución, duración y pistas de audio.

        public string VideoCodec { get; set; } = string.Empty;
        public string AudioCodec { get; set; } = string.Empty;
        public double Duration { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
        public bool RequiresTranscoding { get; set; }
        public List<MediaTrack> AudioTracks { get; set; } = [];
        public List<MediaTrack> SubtitleTracks { get; set; } = [];
    }

    public class MediaTrack
    {
        // Índice absoluto de stream, usado por FFmpeg con -map 0:{Index}.
        public int Index { get; set; }
        public string Language { get; set; } = "und";
        public string Title { get; set; } = "";
        public string Codec { get; set; } = "";
        public bool IsDefault { get; set; }
        public bool IsForced { get; set; }
        public bool IsSupported { get; set; } = true;
    }
}
